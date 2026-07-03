package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"html"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	ListenHost  string
	ListenPort  int
	ClientDir   string
	PublicURL   string
	NginxURL    string
	ElectronAPI string
	OutputRoot  string
	HistoryRoot string
	CacheRoot   string
	IndexRoot   string
	LogsRoot    string
}

type DraftPayload struct {
	Text      string `json:"text"`
	RequestID string `json:"requestId,omitempty"`
}

type HistoryEntry struct {
	Title          string `json:"title"`
	Path           string `json:"path"`
	ModifiedAt     string `json:"modifiedAt"`
	HasGamePreview bool   `json:"hasGamePreview"`
	HasFinalReport bool   `json:"hasFinalReport"`
}

type FileEntry struct {
	Name       string `json:"name"`
	Path       string `json:"path"`
	Kind       string `json:"kind"`
	Size       int64  `json:"size"`
	ModifiedAt string `json:"modifiedAt"`
	PreviewURL string `json:"previewUrl,omitempty"`
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	server := &Server{cfg: cfg, client: &http.Client{Timeout: 20 * time.Second}}
	server.routes(mux)

	addr := net.JoinHostPort(cfg.ListenHost, strconv.Itoa(cfg.ListenPort))
	log.Printf("carvis NAS listening on %s, phone URL %s, electron API %s", addr, cfg.PublicURL, cfg.ElectronAPI)
	log.Fatal(http.ListenAndServe(addr, withCORS(mux)))
}

type Server struct {
	cfg    Config
	client *http.Client
}

func (s *Server) routes(mux *http.ServeMux) {
	mux.HandleFunc("/api/config", s.handleConfig)
	mux.HandleFunc("/api/input", s.handleInput)
	mux.HandleFunc("/api/submit", s.handleSubmit)
	mux.HandleFunc("/api/state", s.handleState)
	mux.HandleFunc("/api/history", s.handleHistory)
	mux.HandleFunc("/api/files", s.handleFiles)
	mux.HandleFunc("/preview", s.handlePreview)
	mux.HandleFunc("/raw", s.handleRaw)
	mux.HandleFunc("/rawfs/", s.handleRawFS)
	mux.Handle("/", http.FileServer(http.Dir(s.cfg.ClientDir)))
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"publicUrl":   s.cfg.PublicURL,
		"nginxUrl":    s.cfg.NginxURL,
		"electronApi": s.cfg.ElectronAPI,
		"lanIp":       defaultString(os.Getenv("CARVIS_LAN_IP"), findLANIP()),
	})
}

func (s *Server) handleInput(w http.ResponseWriter, r *http.Request) {
	var payload DraftPayload
	if err := readJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	s.forwardJSON(w, "/api/input", payload)
}

func (s *Server) handleSubmit(w http.ResponseWriter, r *http.Request) {
	var payload DraftPayload
	if err := readJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(payload.Text) == "" {
		writeError(w, http.StatusBadRequest, errors.New("text is required"))
		return
	}
	if payload.RequestID == "" {
		payload.RequestID = fmt.Sprintf("nas-%d", time.Now().UnixMilli())
	}
	s.forwardJSON(w, "/api/submit", payload)
}

func (s *Server) handleState(w http.ResponseWriter, r *http.Request) {
	upstream, err := s.client.Get(strings.TrimRight(s.cfg.ElectronAPI, "/") + "/api/state")
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	defer upstream.Body.Close()
	copyUpstream(w, upstream)
}

func (s *Server) handleHistory(w http.ResponseWriter, r *http.Request) {
	root, err := s.rootFor("history")
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	history := make([]HistoryEntry, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		relative := entry.Name()
		folder := filepath.Join(root, relative)
		history = append(history, HistoryEntry{
			Title:          readOutputTitle(folder, relative),
			Path:           relative,
			ModifiedAt:     info.ModTime().Format(time.RFC3339),
			HasGamePreview: fileExists(filepath.Join(folder, "game-preview.html")),
			HasFinalReport: fileExists(filepath.Join(folder, "final-report.md")),
		})
	}
	sort.Slice(history, func(i, j int) bool { return history[i].ModifiedAt > history[j].ModifiedAt })
	writeJSON(w, http.StatusOK, map[string]any{"items": history})
}

func (s *Server) handleFiles(w http.ResponseWriter, r *http.Request) {
	rootName := defaultString(r.URL.Query().Get("root"), "output")
	dir, err := s.safePath(rootName, r.URL.Query().Get("path"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	info, err := os.Stat(dir)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	if !info.IsDir() {
		writeError(w, http.StatusBadRequest, errors.New("path is not a directory"))
		return
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	files := make([]FileEntry, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		rel := pathJoinURL(r.URL.Query().Get("path"), entry.Name())
		kind := "file"
		if info.IsDir() {
			kind = "dir"
		}
		item := FileEntry{
			Name:       entry.Name(),
			Path:       rel,
			Kind:       kind,
			Size:       info.Size(),
			ModifiedAt: info.ModTime().Format(time.RFC3339),
		}
		if kind == "file" {
			item.PreviewURL = "/preview?root=" + url.QueryEscape(rootName) + "&path=" + url.QueryEscape(rel)
		}
		files = append(files, item)
	}
	sort.Slice(files, func(i, j int) bool {
		if files[i].Kind != files[j].Kind {
			return files[i].Kind == "dir"
		}
		return files[i].Name < files[j].Name
	})
	writeJSON(w, http.StatusOK, map[string]any{"items": files})
}

func (s *Server) handlePreview(w http.ResponseWriter, r *http.Request) {
	path, err := s.safePath(defaultString(r.URL.Query().Get("root"), "output"), r.URL.Query().Get("path"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	info, err := os.Stat(path)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	if info.IsDir() {
		http.Redirect(w, r, "/api/files?root="+url.QueryEscape(r.URL.Query().Get("root"))+"&path="+url.QueryEscape(r.URL.Query().Get("path")), http.StatusFound)
		return
	}

	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".html", ".htm":
		s.renderHTMLFrame(w, defaultString(r.URL.Query().Get("root"), "output"), r.URL.Query().Get("path"))
	case ".pdf":
		s.renderPDFFrame(w, defaultString(r.URL.Query().Get("root"), "output"), r.URL.Query().Get("path"))
	case ".docx":
		s.renderTextPreview(w, "Word Preview", extractDocxText(path))
	case ".xlsx":
		s.renderTextPreview(w, "Excel Preview", extractXlsxText(path))
	default:
		if isTextExt(ext) {
			data, err := os.ReadFile(path)
			s.renderTextPreview(w, filepath.Base(path), stringResult(string(data), err))
			return
		}
		http.Redirect(w, r, "/raw?"+r.URL.RawQuery, http.StatusFound)
	}
}

func (s *Server) handleRaw(w http.ResponseWriter, r *http.Request) {
	path, err := s.safePath(defaultString(r.URL.Query().Get("root"), "output"), r.URL.Query().Get("path"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(path)))
	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	http.ServeFile(w, r, path)
}

func (s *Server) handleRawFS(w http.ResponseWriter, r *http.Request) {
	parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/rawfs/"), "/", 2)
	if len(parts) != 2 {
		writeError(w, http.StatusBadRequest, errors.New("rawfs path must include root and path"))
		return
	}
	rootName, err := url.PathUnescape(parts[0])
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	relative, err := url.PathUnescape(parts[1])
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	path, err := s.safePath(rootName, relative)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(path)))
	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	http.ServeFile(w, r, path)
}

func (s *Server) forwardJSON(w http.ResponseWriter, endpoint string, payload any) {
	body, err := json.Marshal(payload)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	request, err := http.NewRequest(http.MethodPost, strings.TrimRight(s.cfg.ElectronAPI, "/")+endpoint, bytes.NewReader(body))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	request.Header.Set("Content-Type", "application/json")

	upstream, err := s.client.Do(request)
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	defer upstream.Body.Close()
	copyUpstream(w, upstream)
}

func (s *Server) safePath(rootName, relative string) (string, error) {
	root, err := s.rootFor(rootName)
	if err != nil {
		return "", err
	}
	cleanRel := filepath.Clean(strings.TrimPrefix(relative, "/"))
	if cleanRel == "." {
		cleanRel = ""
	}
	full := filepath.Join(root, cleanRel)
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	fullAbs, err := filepath.Abs(full)
	if err != nil {
		return "", err
	}
	if fullAbs != rootAbs && !strings.HasPrefix(fullAbs, rootAbs+string(os.PathSeparator)) {
		return "", errors.New("path is outside configured root")
	}
	return fullAbs, nil
}

func (s *Server) rootFor(rootName string) (string, error) {
	switch rootName {
	case "output":
		return s.cfg.OutputRoot, nil
	case "history":
		return s.cfg.HistoryRoot, nil
	default:
		return "", fmt.Errorf("unknown root %q", rootName)
	}
}

func (s *Server) renderHTMLFrame(w http.ResponseWriter, rootName, relative string) {
	writeHTML(w, "HTML Preview", `<iframe class="preview-frame" sandbox="allow-scripts allow-forms" src="`+html.EscapeString(rawFSURL(rootName, relative))+`"></iframe>`)
}

func (s *Server) renderPDFFrame(w http.ResponseWriter, rootName, relative string) {
	writeHTML(w, "PDF Preview", `<iframe class="preview-frame" src="`+html.EscapeString(rawFSURL(rootName, relative))+`"></iframe>`)
}

func (s *Server) renderTextPreview(w http.ResponseWriter, title string, result textResult) {
	if result.err != nil {
		writeError(w, http.StatusInternalServerError, result.err)
		return
	}
	writeHTML(w, title, `<pre class="text-preview">`+html.EscapeString(result.text)+`</pre>`)
}

type textResult struct {
	text string
	err  error
}

func stringResult(text string, err error) textResult {
	if len(text) > 512*1024 {
		text = text[:512*1024] + "\n\n[preview truncated]"
	}
	return textResult{text: text, err: err}
}

func extractDocxText(path string) textResult {
	return extractZipXML(path, func(name string) bool {
		return name == "word/document.xml"
	})
}

func extractXlsxText(path string) textResult {
	return extractZipXML(path, func(name string) bool {
		return strings.HasPrefix(name, "xl/worksheets/") || name == "xl/sharedStrings.xml"
	})
}

func extractZipXML(path string, accept func(string) bool) textResult {
	reader, err := zip.OpenReader(path)
	if err != nil {
		return stringResult("", err)
	}
	defer reader.Close()

	var out strings.Builder
	for _, file := range reader.File {
		if !accept(file.Name) {
			continue
		}
		handle, err := file.Open()
		if err != nil {
			continue
		}
		data, _ := io.ReadAll(io.LimitReader(handle, 2*1024*1024))
		handle.Close()
		out.WriteString(xmlText(data))
		out.WriteString("\n")
	}
	text := strings.TrimSpace(out.String())
	if text == "" {
		text = "[empty preview]"
	}
	return stringResult(text, nil)
}

func xmlText(data []byte) string {
	decoder := xml.NewDecoder(bytes.NewReader(data))
	var out strings.Builder
	for {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		if chars, ok := token.(xml.CharData); ok {
			text := strings.TrimSpace(string(chars))
			if text != "" {
				if out.Len() > 0 {
					out.WriteString(" ")
				}
				out.WriteString(text)
			}
		}
	}
	return out.String()
}

func loadConfig() (Config, error) {
	configDir := defaultString(os.Getenv("CARVIS_NAS_CONFIG_DIR"), "config")
	app := readSimpleYAML(filepath.Join(configDir, "app.yaml"))
	remote := readSimpleYAML(filepath.Join(configDir, "remote.yaml"))
	electron := readSimpleYAML(filepath.Join(configDir, "electron.yaml"))
	paths := readSimpleYAML(filepath.Join(configDir, "paths.yaml"))

	port, _ := strconv.Atoi(defaultString(os.Getenv("CARVIS_NAS_PORT"), defaultString(app["listen_port"], "8765")))
	cfg := Config{
		ListenHost:  defaultString(os.Getenv("CARVIS_NAS_HOST"), defaultString(app["listen_host"], "0.0.0.0")),
		ListenPort:  port,
		ClientDir:   absPath(defaultString(os.Getenv("CARVIS_NAS_CLIENT_DIR"), defaultString(app["client_dir"], "apps/client"))),
		PublicURL:   defaultString(os.Getenv("CARVIS_NAS_PUBLIC_URL"), defaultString(remote["public_url"], "http://127.0.0.1:8765")),
		NginxURL:    defaultString(os.Getenv("CARVIS_NGINX_URL"), defaultString(remote["nginx_url"], "http://carvis.lan")),
		ElectronAPI: defaultString(os.Getenv("CARVIS_ELECTRON_API_URL"), defaultString(electron["api_url"], "http://127.0.0.1:45932")),
		OutputRoot:  absPath(defaultString(os.Getenv("CARVIS_OUTPUT_ROOT"), defaultString(paths["output_root"], "../output/runs"))),
		HistoryRoot: absPath(defaultString(os.Getenv("CARVIS_HISTORY_ROOT"), defaultString(paths["history_root"], "../output/runs"))),
		CacheRoot:   absPath(defaultString(paths["cache_root"], "data/cache")),
		IndexRoot:   absPath(defaultString(paths["index_root"], "data/index")),
		LogsRoot:    absPath(defaultString(paths["logs_root"], "data/logs")),
	}
	for _, path := range []string{cfg.CacheRoot, cfg.IndexRoot, cfg.LogsRoot} {
		_ = os.MkdirAll(path, 0o755)
	}
	return cfg, nil
}

func readSimpleYAML(path string) map[string]string {
	data, err := os.ReadFile(path)
	if err != nil {
		return map[string]string{}
	}
	result := map[string]string{}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		result[strings.TrimSpace(key)] = strings.Trim(strings.TrimSpace(value), `"'`)
	}
	return result
}

func readOutputTitle(folder, fallback string) string {
	manifest := filepath.Join(folder, "manifest.json")
	data, err := os.ReadFile(manifest)
	if err == nil {
		var payload map[string]any
		if json.Unmarshal(data, &payload) == nil {
			if title, ok := payload["title"].(string); ok && title != "" {
				return title
			}
		}
	}
	return fallback
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func readJSON(r *http.Request, target any) error {
	defer r.Body.Close()
	return json.NewDecoder(io.LimitReader(r.Body, 1024*1024)).Decode(target)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]any{"ok": false, "error": err.Error()})
}

func copyUpstream(w http.ResponseWriter, upstream *http.Response) {
	for key, values := range upstream.Header {
		if strings.EqualFold(key, "Content-Length") {
			continue
		}
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	w.WriteHeader(upstream.StatusCode)
	_, _ = io.Copy(w, upstream.Body)
}

func writeHTML(w http.ResponseWriter, title, body string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = io.WriteString(w, `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>`+html.EscapeString(title)+`</title><style>body{margin:0;background:#f5dfb8;color:#3b2415;font-family:system-ui,"Microsoft YaHei",sans-serif}.bar{position:sticky;top:0;padding:12px 14px;background:#6b3f1d;color:#fff1cf}.preview-frame{width:100vw;height:calc(100vh - 48px);border:0;background:white}.text-preview{white-space:pre-wrap;overflow-wrap:anywhere;margin:12px;padding:12px;border:3px solid #6b3f1d;background:#fff1cf;line-height:1.5}</style></head><body><div class="bar">`+html.EscapeString(title)+`</div>`+body+`</body></html>`)
}

func isTextExt(ext string) bool {
	switch ext {
	case ".txt", ".md", ".json", ".csv", ".log", ".go", ".ts", ".tsx", ".js", ".jsx", ".html", ".htm", ".css", ".yaml", ".yml":
		return true
	default:
		return false
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func absPath(path string) string {
	if filepath.IsAbs(path) {
		return filepath.Clean(path)
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return filepath.Clean(path)
	}
	return abs
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func pathJoinURL(base, name string) string {
	if base == "" {
		return name
	}
	return strings.Trim(strings.TrimRight(base, "/")+"/"+name, "/")
}

func rawFSURL(rootName, relative string) string {
	parts := []string{"", "rawfs", url.PathEscape(rootName)}
	for _, part := range strings.Split(relative, "/") {
		if part != "" {
			parts = append(parts, url.PathEscape(part))
		}
	}
	return strings.Join(parts, "/")
}

func findLANIP() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return "127.0.0.1"
	}
	for _, item := range interfaces {
		if item.Flags&net.FlagUp == 0 || item.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := item.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			ip := ipNet.IP.To4()
			if ip != nil {
				return ip.String()
			}
		}
	}
	return "127.0.0.1"
}

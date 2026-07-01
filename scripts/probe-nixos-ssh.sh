#!/usr/bin/env bash
set -euo pipefail

user="${1:-howtion}"
password="${CARVIS_SSH_PASSWORD:-123456}"

mapfile -t candidates < <(
  {
    printf '%s\n' 192.168.137.59 192.168.135.250
    getent hosts nixos.local nixos 2>/dev/null | awk '{print $1}'
    ip -4 -br addr | awk '$1 !~ /^(lo|docker|Mihomo)/ {split($3,a,"/"); print a[1]}' | while read -r ip; do
      subnet="${ip%.*}.0/24"
      nmap -p 22 --open "$subnet" -oG - 2>/dev/null | awk '/22\/open/{print $2}'
    done
  } | awk 'NF' | sort -u
)

if [[ "${#candidates[@]}" -eq 0 ]]; then
  echo "no ssh candidates found"
  exit 1
fi

for host in "${candidates[@]}"; do
  printf '== %s ==\n' "$host"
  if sshpass -p "$password" ssh \
    -o ConnectTimeout=5 \
    -o PreferredAuthentications=password \
    -o PubkeyAuthentication=no \
    -o StrictHostKeyChecking=accept-new \
    "${user}@${host}" 'hostname; ip -br addr' 2>&1 | sed -n '1,40p'; then
    echo "usable=$host"
    exit 0
  fi
done

echo "no usable nixos ssh host found"
exit 1

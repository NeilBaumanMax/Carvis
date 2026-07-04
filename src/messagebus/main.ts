import { waitForShutdown } from "../shared/process/lifecycle.js";
import { createMessageBus } from "./index.js";

const bus = createMessageBus();

console.log("[messagebus] ready");
console.log("[messagebus] in-memory protocol active");

void bus;

await waitForShutdown("messagebus");

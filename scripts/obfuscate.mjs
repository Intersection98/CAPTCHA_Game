import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import JavaScriptObfuscator from "javascript-obfuscator";

const assetsDirectory = new URL("../dist/assets/", import.meta.url);
const files = (await readdir(assetsDirectory)).filter((file) => file.endsWith(".js"));

for (const file of files) {
  const path = join(assetsDirectory.pathname, file);
  const source = await readFile(path, "utf8");
  const result = JavaScriptObfuscator.obfuscate(source, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.4,
    deadCodeInjection: false,
    disableConsoleOutput: true,
    identifierNamesGenerator: "hexadecimal",
    renameGlobals: false,
    rotateStringArray: true,
    selfDefending: true,
    shuffleStringArray: true,
    splitStrings: true,
    splitStringsChunkLength: 7,
    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 0.8,
    transformObjectKeys: true,
  });
  await writeFile(path, result.getObfuscatedCode(), "utf8");
}

console.log(`Obfuscated ${files.length} JavaScript bundle${files.length === 1 ? "" : "s"}.`);

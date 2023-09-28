import * as log from "https://deno.land/std@0.170.0/log/mod.ts";
import { brightBlue, cyan, bold } from "https://deno.land/std@0.170.0/fmt/colors.ts";
import * as filepath from "https://deno.land/std@0.170.0/path/mod.ts";
import * as fs from "https://deno.land/std@0.170.0/fs/mod.ts";
import * as bytes from "https://deno.land/std@0.170.0/fmt/bytes.ts";
//import * as zip from "https://deno.land/x/zipjs@v2.3.23/index.js";
import * as jszip from "https://deno.land/x/zippy@0.1.0/mod.ts";

const version = "3.0.0-dev"

function help() {
    //const logger = log.getLogger();
    console.log(bold(brightBlue(`Detonater ${version}`)));
    console.log(cyan("The Deno-powered Fabric/Quilt mod compressor"));

    console.log();
    
    console.log(`Usage: ${bold("detonater")} <target> <options>`);
    console.log("Examples:");
    console.log(`   ${bold("detonater")} testmod-1.0.0+1.64.1.jar`);
    console.log(`   ${bold("detonater")} ./build/libs/*.jar`);

    console.log();

    console.log("Options (WIP):");
    console.log(`   ${bold("--no-json")}\tDisables the JSON normalization`);
    console.log(`   ${bold("--no-png")}\tDisables the image optimization done with oxipng`);
}

if (Deno.args.length === 0) {
    help();
} else {
    if (Deno.args.length === 1) {
        await beginDetonation(Deno.args[0]);
    } else {
        
    }
}

async function beginDetonation(path: string) {
    const parsedPath = filepath.parse(path);
    const paths: string[] = [];

    if (filepath.isGlob(path)) {
        for await (const file of fs.expandGlob(filepath.normalizeGlob(path), { globstar: true })) {
            paths[paths.length] = file.path;
        }

        if (paths.length > 0) {
            const detonatedPath = filepath.join(filepath.common(paths), "/detonated/");
            await fs.ensureDir(detonatedPath);

            for await (const walkEntry of fs.expandGlob(filepath.normalizeGlob(path), { globstar: true })) {
                const file = await Deno.readFile(walkEntry.path);
                const newZip = await detonateJar(file, walkEntry.name, false);
                await Deno.writeFile(filepath.join(detonatedPath, walkEntry.name), newZip);
            }
        }
    } else {
        const detonatedPath = filepath.join(parsedPath.dir, "/detonated/");
        await fs.ensureDir(detonatedPath);

        const file = await Deno.readFile(path);
        const newZip = await detonateJar(file, parsedPath.base, false);
        // console.log(parsedPath.base);
        await Deno.writeFile(filepath.join(detonatedPath, parsedPath.base), newZip);
    }
}

async function detonateJar(data: Uint8Array, name: string, jij: boolean) : Promise<Uint8Array> {
    console.log(`Detonating ${name}...`);
    if (!jij) {
        performance.mark("Test");
    }
    
    const newZip = new jszip.JSZip();
    
    const zip = new jszip.JSZip();
    await zip.loadAsync(data, { optimizedBinaryString: true });

    // Sort the file keys, ensuring smaller file sizes
    let keys = [];
    for (const key in zip.files()) {
        keys.push(key);
    }
    keys = keys.sort((a, b) => a > b ? 1 : (a < b ? -1 : 0));
    // console.log(keys);

    const promises: Promise<Uint8Array>[] = [];
    const newDataObject: { [key: string]: Uint8Array } = {}

    for (const key of keys) {
        const file = zip.files()[key];
        const data = await file.async("uint8array");
        if (file.name.endsWith(".json") || file.name.endsWith(".mcmeta")) {
            promises.push(normalizeJson(data).then((newData) => {
                Object.defineProperty(newDataObject, key, {
                    value: newData
                });
                return newData;
            }));
        } else if (file.name.endsWith(".png")) {
            promises.push(optimizePng(data).then((newData) => {
                Object.defineProperty(newDataObject, key, {
                    value: newData
                });
                return newData;
            }));
        } else if (file.name.endsWith(".jar")) {
            promises.push(detonateJar(data, file.name, true).then((newData) => {
                Object.defineProperty(newDataObject, key, {
                    value: newData
                });
                return newData;
            }));
        } else {
            Object.defineProperty(newDataObject, key, {
                value: data
            });
        }
    }

    await Promise.all(promises);

    for (const key of keys) {
        newZip.addFile(key, newDataObject[key]);
    }

    const generatedZip = await newZip.generateAsync({
        compression: jij ? "STORE" : "DEFLATE",
        compressionOptions: jij ? null : { level: 9 },
        mimeType: "application/java-archive",
        type: "uint8array"
    });

    if (!jij) {
        performance.mark("Test");
        console.log(performance.measure("Test").duration);
        performance.clearMarks("Test");
        performance.clearMeasures("Test");
    }
    
    console.log(`Successfully detonated ${name}! Size: ${bytes.format(generatedZip.length)} ${jij ? "(JiJ, Uncompressed)" : "(Mod, Compressed!)"}`)

    return generatedZip;
}

async function normalizeJson(data : Uint8Array) : Promise<Uint8Array> {
    try {
        const json = await JSON.parse(new TextDecoder("utf-8").decode(data));
        const normalizedJson = new TextEncoder().encode(JSON.stringify(json, null, 2));
        return normalizedJson;
    } catch (error) {
        console.error("The JSON file is malformed! It won't be minified.");
        console.error(error);
        return data;
    }
}

async function optimizePng(data : Uint8Array) : Promise<Uint8Array> {
    try {
        const command = new Deno.Command("oxipng", {
            args: [
                "--opt", "max",
                "--strip", "safe",
                "--alpha",
                "--stdout", "-"
            ],
            stdin: "piped",
            stdout: "piped",
            stderr: "piped",
        });
        
        const child = command.spawn();
        const writer = child.stdin.getWriter();
        
        await writer.write(data);
        writer.releaseLock();
        child.stdin.close();

        const result = await child.output();

        return result.stdout;
    } catch (error) {
        console.error("Error optimizing image:", error);
        return data;
    }
}
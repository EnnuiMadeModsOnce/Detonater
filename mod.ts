import * as log from "https://deno.land/std@0.119.0/log/mod.ts";
import { brightBlue, cyan, bold } from "https://deno.land/std@0.119.0/fmt/colors.ts";
import * as filepath from "https://deno.land/std@0.119.0/path/mod.ts";
import * as fs from "https://deno.land/std@0.119.0/fs/mod.ts";
import { prettyBytes } from "https://deno.land/std@0.119.0/fmt/bytes.ts";
//import * as zip from "https://deno.land/x/zipjs@v2.3.23/index.js";
import * as fflate from 'https://cdn.skypack.dev/fflate?dts';
import * as jszip from "https://deno.land/x/jszip/mod.ts";

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
    const paths = [];

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

        /*
        const regex = filepath.globToRegExp(path);

        console.log(regex);

        const detonatedPath = filepath.join(parsedPath.root, "/detonated/");
        await fs.ensureDir(detonatedPath);

        for await (const walkEntry of fs.walk(".", { includeDirs: false, match: [regex] })) {
            const file = await Deno.readFile(walkEntry.path);
            console.log(walkEntry.name);
            const newZip = await detonateJar(file, false);
            await Deno.writeFile(filepath.join(detonatedPath, walkEntry.name), newZip);
        }
        */
    } else {
        const file = await Deno.readFile(path);
        const newZip = await detonateJar(file, parsedPath.name, false);
        await Deno.writeFile(path.concat("d"), newZip);
    }
}

async function detonateJar(data: Uint8Array, name: string, jij: boolean) : Promise<Uint8Array> {
    console.log(`Detonating ${name}...`);

    const newZip = new fflate.Zip();
    let returnedData = new Uint8Array();
    newZip.ondata = (err, data, final) => {
        returnedData = new Uint8Array([...returnedData, ...data]);
        if (final) {
            return returnedData;
        }
    }

    let promises: Promise<Uint8Array>[] = []

    const unzipper = new fflate.Unzip();
    unzipper.register(fflate.UnzipInflate);
    unzipper.onfile = file => {
        const newFile = jij ? new fflate.ZipDeflate(file.name, { level: 0 }) : new fflate.ZipDeflate(file.name, { level: 9, mem: 8 });
        newZip.add(newFile);
        let newData = new Uint8Array();
        file.ondata = async (err, data, final) => {
            if (file.name.endsWith(".json") || file.name.endsWith(".mcmeta")) {
                newData = new Uint8Array([...newData, ...data]);
                if (final) {
                    const i = promises.length;
                    promises[i] = normalizeJson(newData);
                    newFile.push(await promises[i], true);
                }
            } else if (file.name.endsWith(".png")) {
                newData = new Uint8Array([...newData, ...data]);
                if (final) {
                    const i = promises.length;
                    promises[i] = optimizePng(newData);
                    newFile.push(await promises[i], true);
                }
            } else if (file.name.endsWith(".jar")) {
                newData = new Uint8Array([...newData, ...data]);
                if (final) {
                    const i = promises.length;
                    promises[i] = detonateJar(newData, file.name, true);
                    newFile.push(await promises[i], true);
                }
            } else {
                newFile.push(data, final);
            }
            //newFile.push(data, final);
        }
        file.start();
    };
    unzipper.push(data, true);
    
    await Promise.all(promises);
    newZip.end();
    console.log(`Successfully detonated ${name}! Size: ${prettyBytes(returnedData.length)} ${jij ? "(JiJ, Uncompressed)" : "(Mod, Compressed!)"}`)

    return returnedData;
}

async function detonateJarWithJSZip(data: Uint8Array, name: string, jij: boolean) : Promise<Uint8Array> {
    console.log(`Detonating ${name}...`);
    
    const newZip = new jszip.JSZip();
    
    const zip = new jszip.JSZip();
    await zip.loadAsync(data, { optimizedBinaryString: true });
    for (const key in zip.files()) {
        const file = zip.files()[key];
        let data = await file.async("uint8array");
        if (file.name.endsWith(".json") || file.name.endsWith(".mcmeta")) {
            data = await normalizeJson(data);
        } else if (file.name.endsWith(".png")) {
            data = await optimizePng(data);
        } else if (file.name.endsWith(".jar")) {
            data = await detonateJarWithJSZip(data, file.name, true);
        }

        newZip.addFile(file.name, data);
    }

    const generatedZip = await newZip.generateAsync({
		compression: jij ? "STORE" : "DEFLATE",
		compressionOptions: jij ? null : { level: 9 },
		mimeType: "application/java-archive",
		type: "uint8array"
	});

    console.log(`Successfully detonated ${name}! Size: ${prettyBytes(generatedZip.length)} ${jij ? "(JiJ, Uncompressed)" : "(Mod, Compressed!)"}`)

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
    const tempPng = await Deno.makeTempFile({ prefix: "detonater_", suffix: ".png" });
    try {
        await Deno.writeFile(tempPng, data);
        await Deno.run({
            cmd: ["oxipng", `--opt`, `max`, `-D`, `--strip`, `safe`, `--alpha`, tempPng],
            stdout: "piped"
        }).output();
        const newData = await Deno.readFile(tempPng);
        Deno.remove(tempPng);
        return newData;
    } catch {
        await Deno.remove(tempPng);
        return data;
    }
}
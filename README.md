# Detonater

The Detonater is a Deno-powered CLI tool that compresses Fabric/Quilt mods into even smaller ones!

<!--
Oh, and before you say "The name has a typo on it! It's supposed to be the Detonator!", this "typo" is intentional. "Detonater" is an anagram of "Deno Tater"!
I even went off my way to immediately rename the whole project after the initial release once I realized that I missed an opportunity there, so, yeah, it's not a bug, it's a feature
-->

This tool is pretty effective on huge content mods and on mods that have Jar-in-Jar dependencies.

The following strategies are used in the process of detonating a mod:
- All PNG assets of the mod are losslessly optimized with [oxipng](https://github.com/shssoichiro/oxipng).
- All JSON and mcmeta files are normalized, helping a little with compression efforts through consistency.
- All JAR files inside the to-be-detonated JAR are decompressed, optimized by the above strategies, repackaged in Store mode, and then compressed by the main JAR, resulting into massive savings.

## Usage

In order to run this tool, you will need to have [Deno](https://deno.land/) and [oxipng](https://github.com/shssoichiro/oxipng) installed.

After both are installed, you can now install the Detonater as a CLI utility with the following command:

`$ deno install --allow-read --allow-write --allow-run -n "detonater" https://raw.githubusercontent.com/EnnuiL/Detonater/dev/mod.ts`

Now you have the Detonater installed! Some examples of usage of this command are:

`$ detonater flamingo-1.0.0.jar`

`$ detonater ./build/libs/*.jar`

More information about the tool is available with the `detonater --help` command.

## License

This tool is licensed under the MIT license. You must give attribution to this project if you incorporate parts of this project's code. This license is not applied to the output of the tool.

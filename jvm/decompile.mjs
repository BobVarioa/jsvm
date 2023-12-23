import fs from "node:fs";
import process from "node:process"
import { ClassFile, LooseUint8Array } from "./index.mjs";

let file = fs.readFileSync(process.argv[2]);
const data = new LooseUint8Array();
data.fromBuffer(file);
const classFile = new ClassFile();
classFile.read(data);
fs.writeFileSync(
	process.argv[2] + ".json",
	classFile.toJson()
);

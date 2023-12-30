import { AccessFlags, ClassFile, LooseUint8Array } from "../index.mjs";
import fs from "node:fs";

const cf = new ClassFile();

cf.access_flags = AccessFlags.File_Public | AccessFlags.File_Super;

cf.setSuperClass("java.lang.Object");
cf.setThisClass("HelloWorldGen");

const objectNew = cf.createMethodRef("java.lang.Object", "<init>", "void", []);

cf.addMethod(
	AccessFlags.Method_Public,
	"<init>",
	"void",
	[],
	[
		cf.createCode(1, 1, [
			cf.createBytecode("aload_0"), // this obj
			cf.createBytecode("invokespecial", objectNew), // super()
			cf.createBytecode("return"),
		], [
			cf.createAttribute("LineNumberTable", [
				cf.createLineNumber(0, 1),
			])
		]),
	]
);

const systemOut = cf.createFieldRef(
	"java.lang.System",
	"out",
	"java.io.PrintStream"
);

const println = cf.createMethodRef(
	"java.io.PrintStream",
	"println",
	"void",
	["java.lang.String"]
)

cf.addMethod(
	AccessFlags.Method_Public | AccessFlags.Method_Static,
	"main",
	"void",
	["java.lang.String[]"],
	[
		cf.createCode(2, 1, [
			cf.createBytecode("getstatic", systemOut),
			cf.createBytecode("ldc", cf.createString("Hello, world!")),
			cf.createBytecode("invokevirtual", println),
			cf.createBytecode("return"),
		], [
			cf.createAttribute("LineNumberTable", [
				cf.createLineNumber(0, 6),
				cf.createLineNumber(8, 7),
			])
		]),
	]
);

cf.addAttribute(cf.createAttribute("SourceFile", cf.createUtf8("HelloWorldGen.java")));

const buff = cf.generate();
fs.writeFileSync("./HelloWorldGen.class", buff);

const cf2 = new ClassFile();
const data = new LooseUint8Array();
data.fromBuffer(buff);
cf2.read(data);
fs.writeFileSync("./HelloWorldGen.class.json", cf2.toJson());

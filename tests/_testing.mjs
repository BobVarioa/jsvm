import { EBNF, EBNFAst, EBNFTokenizer } from "../bnf/index.mjs";
import fs from "node:fs";

const file = fs.readFileSync("../bnf/js.ebnf", "utf-8");
const file2 = fs.readFileSync("../tests/full.js", "utf-8");

function json(s) {
	return JSON.stringify(s, (k, v) => (v instanceof Set ? [...v] : v), 4);
}

let ast = new EBNF();
let parse = ast.parse(file);
fs.writeFileSync("./build/bnf.json", json(parse));

let intTokens = new EBNFTokenizer(parse);
let tokens = intTokens.run(file2);
fs.writeFileSync("./build/tokens.json", json(tokens));

let intAst = new EBNFAst(parse);
fs.writeFileSync("./build/ast.json", json(intAst.run(tokens)));

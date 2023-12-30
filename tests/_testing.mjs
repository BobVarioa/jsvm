import { EBNF, EBNFAst, EBNFTokenizer } from "../bnf/index.mjs";
import fs from "node:fs";

const file = fs.readFileSync("../bnf/js.ebnf", "utf-8");
const file2 = fs.readFileSync("../tests/full.js", "utf-8");

function json(s) {
	return JSON.stringify(s, (k, v) => (v instanceof Set ? [...v] : v), 4);
}

const bnf = new EBNF();
const parse = bnf.parse(file);
fs.writeFileSync("./build/bnf.json", json(parse));

const intTokens = new EBNFTokenizer(parse);
const tokens = intTokens.run(file2);
fs.writeFileSync("./build/tokens.json", json(tokens));

const intAst = new EBNFAst(parse);
const ast = intAst.run(tokens);
fs.writeFileSync("./build/ast.json", json(ast));

import fs from "node:fs";
import os from "node:os";

const ENDIANNESS = os.endianness();

let fromU2 = ENDIANNESS == "LE" ? fromLEU2 : fromBEU2;
function fromLEU2(num) {
	let a = num & 0xff;
	let b = num >> 8;
	return [a, b];
}
function fromBEU2(num) {
	let a = num & 0xff;
	let b = num >> 8;
	return [b, a];
}

let u4 = ENDIANNESS == "LE" ? fromLEU4 : fromBEU4;
function fromLEU4(num) {
	let a = (num >> 0) & 0xff;
	let b = (num >> 8) & 0xff;
	let c = (num >> 16) & 0xff;
	let d = (num >> 24) & 0xff;
	return [a, b, c, d];
}
function fromBEU4(num) {
	let a = (num >> 0) & 0xff;
	let b = (num >> 8) & 0xff;
	let c = (num >> 16) & 0xff;
	let d = (num >> 24) & 0xff;
	return [d, c, b, a];
}

class LooseUint8Array {
	data;
	view;
	size;
	offset = 0;

	constructor() {
		this.size = 8;
		this.data = new ArrayBuffer(this.size, { maxByteLength: 2 ** 32 });
		this.view = new Uint8Array(this.data);
	}

	/**
	 *
	 * @param {Buffer} buffer
	 */
	from(buffer) {
		this.resize(buffer.byteLength);
		for (let i = 0; i < buffer.byteLength; i++) {
			this.view[i] = buffer.readInt8(i);
		}
	}

	resize(n) {
		this.data.resize(n);
		this.size = n;
	}

	push_u1(...bytes) {
		for (let i = 0; i < bytes.length; i++) {
			if (this.offset >= this.size) {
				this.resize(this.size * 2);
			}
			this.view[this.offset] = bytes[i];
			this.offset++;
		}
	}

	push_u2(...bytes) {
		for (let i = 0; i < bytes.length; i++) {
			if (this.offset >= this.size) {
				this.resize(this.size * 2);
			}
			let [a, b] = fromU2(bytes[i]);
			this.view[this.offset] = a;
			this.view[this.offset + 1] = b;
			this.offset += 2;
		}
	}

	push_u4(...bytes) {
		for (let i = 0; i < bytes.length; i++) {
			if (this.offset >= this.size) {
				this.resize(this.size * 2);
			}
			let [a, b, c, d] = u4(bytes[i]);
			this.view[this.offset] = a;
			this.view[this.offset + 1] = b;
			this.view[this.offset + 2] = c;
			this.view[this.offset + 3] = d;
			this.offset += 4;
		}
	}

	rev_offset = 0;

	shift_u1() {
		let byte = this.view[this.rev_offset];
		this.rev_offset++;
		return byte;
	}

	shift_u2() {
		let a = this.view[this.rev_offset];
		let b = this.view[this.rev_offset + 1];
		this.rev_offset += 2;
		return ((a >> 8) | b) >>> 0;
	}

	shift_u4() {
		let a = this.view[this.rev_offset + 0];
		let b = this.view[this.rev_offset + 1];
		let c = this.view[this.rev_offset + 2];
		let d = this.view[this.rev_offset + 3];
		this.rev_offset += 4;
		return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
	}

	shift_bytes(n) {
		let arr = [...this.view.slice(this.rev_offset, this.rev_offset + n)];
		this.rev_offset += n;
		return arr;
	}
}

const ReferenceKind = {
	REF_getField: 1,
	REF_getStatic: 2,
	REF_putField: 3,
	REF_putStatic: 4,
	REF_invokeVirtual: 5,
	REF_invokeStatic: 6,
	REF_invokeSpecial: 7,
	REF_newInvokeSpecial: 8,
	REF_invokeInterface: 9,
};

const AccessFlags = {
	Class_Public: 0x0001,
	Class_Private: 0x0002,
	Class_Protected: 0x0004,
	Class_Static: 0x0008,
	Class_Final: 0x0010,
	Class_Volatile: 0x0040,
	Class_Transient: 0x0080,
	Class_Synthetic: 0x1000,
	Class_Annotation: 0x2000,
	Class_Enum: 0x4000,

	Field_Public: 0x0001,
	Field_Private: 0x0002,
	Field_Protected: 0x0004,
	Field_Static: 0x0008,
	Field_Final: 0x0010,
	Field_Volatile: 0x0040,
	Field_Transient: 0x0080,
	Field_Synthetic: 0x1000,
	Field_Enum: 0x4000,

	Method_Public: 0x0001,
	Method_Private: 0x0002,
	Method_Protected: 0x0004,
	Method_Static: 0x0008,
	Method_Final: 0x0010,
	Method_Synchronized: 0x0020,
	Method_Bridge: 0x0040,
	Method_Varargs: 0x0080,
	Method_NATIVE: 0x0100,
	Method_ABSTRACT: 0x0400,
	Method_ABSTRACT: 0x0800,
	Method_Synthetic: 0x1000,
};

const Constants = {
	Constant_Class: 7,
	Constant_Fieldref: 9,
	Constant_Methodref: 10,
	Constant_InterfaceMethodref: 11,
	Constant_String: 8,
	Constant_Integer: 3,
	Constant_Float: 4,
	Constant_Long: 5,
	Constant_Double: 6,
	Constant_NameAndType: 12,
	Constant_Utf8: 1,
	Constant_MethodHandle: 15,
	Constant_MethodType: 16,
	Constant_InvokeDynamic: 18,
};

const ConstantsById = Object.fromEntries(
	Object.entries(Constants).map((v) => [v[1], v[0]])
);

const ConstantTypes = {
	[Constants.Constant_Class]: {
		generate(name_index) {
			return (file) => {
				file.push_u2(name_index);
			};
		},
		read(file) {
			return {
				name_index: file.shift_u2(),
			};
		},
	},
	[Constants.Constant_Fieldref]: {
		generate(class_index, name_and_type_index) {
			return (file) => {
				file.push_u2(class_index);
				file.push_u2(name_and_type_index);
			};
		},
		read(file) {
			return {
				class_index: file.shift_u2(),
				name_and_type_index: file.shift_u2(),
			};
		},
	},
	[Constants.Constant_Methodref]: {
		generate(class_index, name_and_type_index) {
			return (file) => {
				file.push_u2(class_index);
				file.push_u2(name_and_type_index);
			};
		},
		read(file) {
			return {
				class_index: file.shift_u2(),
				name_and_type_index: file.shift_u2(),
			};
		},
	},
	[Constants.Constant_InterfaceMethodref]: {
		generate(class_index, name_and_type_index) {
			return (file) => {
				file.push_u2(class_index);
				file.push_u2(name_and_type_index);
			};
		},
		read(file) {
			return {
				class_index: file.shift_u2(),
				name_and_type_index: file.shift_u2(),
			};
		},
	},
	[Constants.Constant_String]: {
		generate(string_index) {
			return (file) => {
				file.push_u2(string_index);
			};
		},
		read(file) {
			return {
				string_index: file.shift_u2(),
			};
		},
	},
	[Constants.Constant_Integer]: {
		generate(bytes) {
			return (file) => {
				file.push_u4(bytes);
			};
		},
		read(file) {
			return {
				bytes: file.shift_u4(),
			};
		},
	},
	[Constants.Constant_Float]: {
		generate(bytes) {
			return (file) => {
				file.push_u4(bytes);
			};
		},
		read(file) {
			return {
				bytes: file.shift_u4(),
			};
		},
	},
	[Constants.Constant_Double]: {
		generate(high_bytes, low_bytes) {
			return (file) => {
				file.push_u4(high_bytes);
				file.push_u4(low_bytes);
			};
		},
		read(file) {
			return {
				high_bytes: file.shift_u4(),
				low_bytes: file.shift_u4(),
			};
		},
	},
	[Constants.Constant_NameAndType]: {
		generate(name_index, descriptor_index) {
			return (file) => {
				file.push_u2(name_index);
				file.push_u2(descriptor_index);
			};
		},
		read(file) {
			return {
				name_index: file.shift_u2(),
				descriptor_index: file.shift_u2(),
			};
		},
	},
	[Constants.Constant_Utf8]: {
		generate(str) {
			return (file) => {
				let code = Array.from(str).map((v) => v.codePointAt(0));
				file.push_u2(code.length);
				file.push_u1(...code);
			};
		},
		read(file) {
			let length = file.shift_u2();
			let arr = [];
			for (let i = 0; i < length; i++) {
				arr.push(file.shift_u1());
			}
			return Array.from(arr)
				.map((v) => String.fromCodePoint(v))
				.join("");
		},
	},
	[Constants.Constant_MethodHandle]: {
		generate(reference_kind, reference_index) {
			return (file) => {
				file.push_u1(ReferenceKind[reference_kind]);
				file.push_u2(reference_index);
			};
		},
		read(file) {
			return {
				reference_kind: file.shift_u1(),
				reference_index: file.shift_u2(),
			};
		},
	},
	[Constants.Constant_MethodType]: {
		generate(descriptor_index) {
			return (file) => {
				file.push_u2(descriptor_index);
			};
		},
		read(file) {
			return {
				descriptor_index: file.shift_u2(),
			};
		},
	},
	[Constants.Constant_InvokeDynamic]: {
		generate(bootstrap_method_attr_index, name_and_type_index) {
			return (file) => {
				file.push_u2(bootstrap_method_attr_index);
				file.push_u2(name_and_type_index);
			};
		},
		read(file) {
			return {
				bootstrap_method_attr_index: file.shift_u2(),
				name_and_type_index: file.shift_u2(),
			};
		},
	},
};

/**
 * @type {Record<string, {generate: (...args) =>{ size: () => number, write: (file: LooseUint8Array) => void }, read: (file: LooseUint8Array, constants: any[]) => any}>}
 */
const Attributes = {
	ConstantValue: {
		generate(constantvalue_index) {
			return {
				size() {
					return 2;
				},
				write(file) {
					file.push_u2(constantvalue_index);
				},
			};
		},
		read(file) {
			const obj = {
				constantvalue_index: file.shift_u2(),
			};
			return obj;
		},
	},
	Code: {
		generate(max_stack, max_locals, code, exception_table, attributes) {
			return {
				size() {
					let size =
						// max_stack
						2 +
						// max_locals
						2 +
						// code length
						4 +
						// code
						1 * code.length +
						// exception table length
						+2;
					// exception table
					8 * exception_table.length +
						// attributes length
						2;
					for (const a of attributes) {
						size += a.size();
					}
					return size;
				},
				write(file) {
					file.push_u2(max_stack);
					file.push_u2(max_locals);

					file.push_u4(code.length);
					for (const c of code) {
						file.push_u1(c);
					}

					file.push_u2(exception_table.length);
					for (const e of exception_table) {
						file.push_u2(e.start_pc);
						file.push_u2(e.end_pc);
						file.push_u2(e.handler_pc);
						file.push_u2(e.catch_type);
					}

					file.push_u2(attributes.length);
					for (const a of attributes) {
						writeAttribute(file, a);
					}
				},
			};
		},
		read(file, constants) {
			let obj = {
				max_stack: file.shift_u2(),
				max_locals: file.shift_u2(),
			};

			let code_len = file.shift_u4();
			let code = [];
			for (let i = 0; i < code_len; i++) {
				const opcode = file.shift_u1();
				const name = Opcodes[opcode];
				const instruct = OpcodesType[name];
				let obj =
					typeof instruct.read == "function"
						? instruct.read(file)
						: {};
				obj.opcode = opcode;
				obj.name = name;
				if (instruct.size) {
					i += instruct.size();
				}
				code.push(obj);
			}
			obj.code = code;

			let exception_len = file.shift_u2();
			let exceptions = [];
			for (let i = 0; i < exception_len; i++) {
				exceptions.push({
					start_pc: file.shift_u2(),
					end_pc: file.shift_u2(),
					handler_pc: file.shift_u2(),
					catch_type: file.shift_u2(),
				});
			}
			obj.exceptions = exceptions;

			let attributes_length = file.shift_u2();
			let attributes = [];
			for (let i = 0; i < attributes_length; i++) {
				attributes.push(readAttribute(file, constants));
			}
			obj.attributes = attributes;

			return obj;
		},
	},
	StackMapTable: {
		// TODO: finish (4.7.4)
		generate(entries) {
			return {
				size() {
					let size = 2;
				},
				write(file) {},
			};
		},
		read(file, constants) {
			throw new Error();
		},
	},
	Exceptions: {
		generate(exceptions) {
			return {
				size() {
					return 2 + 2 * exceptions.length;
				},
				write(file) {
					file.push_u2(exceptions.length);

					for (const e of exceptions) {
						file.push_u2(e);
					}
				},
			};
		},
		read(file, constants) {
			let exception_len = file.shift_u2();
			let exceptions = [];
			for (let i = 0; i < exception_len; i++) {
				exceptions.push(file.shift_u2());
			}

			return exceptions;
		},
	},
	InnerClasses: {
		generate(classes) {
			return {
				size() {
					return 2 + 8 * classes.length;
				},
				write(file) {
					file.push_u2(classes.length);
					for (const c of classes) {
						file.push_u2(inner_class_info_index);
						file.push_u2(outer_class_info_index);
						file.push_u2(inner_name_index);
						file.push_u2(inner_class_access_flags);
					}
				},
			};
		},
		read(file, constants) {
			let classes_len = file.shift_u2();
			let classes = [];
			for (let i = 0; i < classes_len; i++) {
				classes.push({
					inner_class_info_index: file.shift_u2(),
					outer_class_info_index: file.shift_u2(),
					inner_name_index: file.shift_u2(),
					inner_class_access_flags: file.shift_u2(),
				});
			}
			return classes;
		},
	},
	EnclosingMethod: {
		generate(class_index, method_index) {
			return {
				size() {
					return 4;
				},
				write(file) {
					file.push_u2(class_index);
					file.push_u2(method_index);
				},
			};
		},
		read(file, constants) {
			return {
				class_index: file.shift_u2(),
				method_index: file.shift_u2(),
			};
		},
	},
	Synthetic: {
		generate() {
			return {
				size() {
					return 0;
				},
				write(file) {},
			};
		},
		read(file) {},
	},
	Signature: {
		generate(signature_index) {
			return {
				size() {
					return 2;
				},
				write(file) {
					file.push_u2(signature_index);
				},
			};
		},
		read(file) {
			return {
				signature_index: file.shift_u2(),
			};
		},
	},
	SourceFile: {
		generate(sourcefile_index) {
			return {
				size() {
					return 2;
				},
				write(file) {
					file.push_u2(sourcefile_index);
				},
			};
		},
		read(file) {
			return {
				sourcefile_index: file.shift_u2(),
			};
		},
	},
	SourceDebugExtension: {
		generate(str) {
			return {
				size() {
					return 2 + Array.from(str).length;
				},
				write(file) {
					let code = Array.from(str).map((v) => v.codePointAt(0));
					file.push_u2(code.length);
					file.push_u2(...code);
				},
			};
		},
		read(file) {
			let length = file.shift_u2();
			let arr = [];
			for (let i = 0; i < length; i++) {
				arr.push(file.shift_u1());
			}
			return Array.from(arr)
				.map((v) => String.fromCodePoint(v))
				.join("");
		},
	},
	LineNumberTable: {
		generate(line_numbers) {
			return {
				size() {
					return 2 + 4 * line_numbers.length;
				},
				write(file) {
					file.push_u2(line_numbers.length);
					for (const ln of line_numbers) {
						file.push_u2(ln.start_pc);
						file.push_u2(ln.line_number);
					}
				},
			};
		},
		read(file) {
			let line_number_len = file.shift_u2();
			let line_numbers = [];
			for (let i = 0; i < line_number_len; i++) {
				line_numbers.push({
					start_pc: file.shift_u2(),
					line_number: file.shift_u2(),
				});
			}
			return line_numbers;
		},
	},
	LocalVariableTable: {
		generate(local_variables) {
			return {
				size() {
					return 2 + 10 * local_variables.length;
				},
				write(file) {
					file.push_u2(local_variables.length);
					for (const lv of local_variables) {
						file.push_u2(lv.start_pc);
						file.push_u2(lv.length);
						file.push_u2(lv.name_index);
						file.push_u2(lv.descriptor_index);
						file.push_u2(lv.index);
					}
				},
			};
		},
		read(file) {
			let local_variables_len = file.shift_u2();
			let local_variables = [];
			for (let i = 0; i < local_variables_len; i++) {
				local_variables.push({
					start_pc: file.shift_u2(),
					length: file.shift_u2(),
					name_index: file.shift_u2(),
					descriptor_index: file.shift_u2(),
					index: file.shift_u2(),
				});
			}
			return local_variables;
		},
	},
	LocalVariableTable: {
		generate(local_variables) {
			return {
				size() {
					return 2 + 10 * local_variables.length;
				},
				write(file) {
					file.push_u2(local_variables.length);
					for (const lv of local_variables) {
						file.push_u2(lv.start_pc);
						file.push_u2(lv.length);
						file.push_u2(lv.name_index);
						file.push_u2(lv.signature_index);
						file.push_u2(lv.index);
					}
				},
			};
		},
		read(file) {
			let local_variables_len = file.shift_u2();
			let local_variables = [];
			for (let i = 0; i < local_variables_len; i++) {
				local_variables.push({
					start_pc: file.shift_u2(),
					length: file.shift_u2(),
					name_index: file.shift_u2(),
					signature_index: file.shift_u2(),
					index: file.shift_u2(),
				});
			}
			return local_variables;
		},
	},
	Deprecated: {
		generate() {
			return {
				size() {
					return 0;
				},
				write(file) {},
			};
		},
		read(file) {},
	},
	RuntimeVisibleAnnotations: {
		// TODO: finish (4.7.16)
		generate() {
			return {
				size() {},
				write(file) {},
			};
		},
		read(file) {},
	},
	RuntimeInvisibleAnnotations: {
		// TODO: finish (4.7.17)
		generate() {
			return {
				size() {},
				write(file) {},
			};
		},
		read(file) {},
	},
	RuntimeVisibleParameterAnnotations: {
		// TODO: finish (4.7.18)
		generate() {
			return {
				size() {},
				write(file) {},
			};
		},
		read(file) {},
	},
	RuntimeInvisibleParameterAnnotations: {
		// TODO: finish (4.7.19)
		generate() {
			return {
				size() {},
				write(file) {},
			};
		},
		read(file) {},
	},
	RuntimeVisibleTypeAnnotations: {
		// TODO: finish (4.7.20)
		generate() {
			return {
				size() {},
				write(file) {},
			};
		},
		read(file) {},
	},
	RuntimeInvisibleTypeAnnotations: {
		// TODO: finish (4.7.21)
		generate() {
			return {
				size() {},
				write(file) {},
			};
		},
		read(file) {},
	},
	AnnotationDefault: {
		// TODO: finish (4.7.22)
		generate() {
			return {
				size() {},
				write(file) {},
			};
		},
		read(file) {},
	},
	BootstrapMethods: {
		generate(bootstrap_methods) {
			return {
				size() {
					let size = 2;
					for (const bm of bootstrap_methods) {
						size += 2 + 2 * bm.bootstrap_arguments.length;
					}
					return size;
				},
				write(file) {
					file.push_u2(bootstrap_methods.length);
					for (const bm of bootstrap_methods) {
						file.push_u2(bm.bootstrap_method_ref);
						file.push_u2(bm.bootstrap_arguments.length);
						file.push_u2(...bm.bootstrap_arguments);
					}
				},
			};
		},
		read(file) {
			let bootstrap_methods_len = file.shift_u2();
			let bootstrap_methods = [];
			for (let i = 0; i < bootstrap_methods_len; i++) {
				let obj = { bootstrap_method_ref: file.shift_u2() };
				let bootstrap_arguments_len = file.shift_u2();
				let bootstrap_arguments = [];
				for (let j = 0; j < bootstrap_arguments_len; j++) {
					bootstrap_arguments.push(file.shift_u2());
				}
				obj.bootstrap_arguments = bootstrap_arguments;

				bootstrap_methods.push(obj);
			}
		},
	},
	MethodParameters: {
		generate(parameters) {
			return {
				size() {
					return 1 + 4 * parameters.length;
				},
				write(file) {
					file.push_u1(parameters.length);
					for (const p of parameters) {
						file.push_u2(p.name_index);
						file.push_u2(p.access_flags);
					}
				},
			};
		},
		read(file) {
			let parameters_len = file.shift_u2();
			let parameters = [];
			for (let i = 0; i < parameters_len; i++) {
				parameters.push({
					name_index: file.shift_u2(),
					access_flags: file.shift_u2(),
				});
			}
			return parameters;
		},
	},
};

const Opcodes = {
	0: "nop",
	1: "aconst_null",
	2: "iconst_m1",
	3: "iconst_0",
	4: "iconst_1",
	5: "iconst_2",
	6: "iconst_3",
	7: "iconst_4",
	8: "iconst_5",
	9: "lconst_0",
	10: "lconst_1",
	11: "fconst_0",
	12: "fconst_1",
	13: "fconst_2",
	14: "dconst_0",
	15: "dconst_1",
	16: "bipush",
	17: "sipush",
	18: "ldc",
	19: "ldc_w",
	20: "ldc2_w",
	21: "iload",
	22: "lload",
	23: "fload",
	24: "dload",
	25: "aload",
	26: "iload_0",
	27: "iload_1",
	28: "iload_2",
	29: "iload_3",
	30: "lload_0",
	31: "lload_1",
	32: "lload_2",
	33: "lload_3",
	34: "fload_0",
	35: "fload_1",
	36: "fload_2",
	37: "fload_3",
	38: "dload_0",
	39: "dload_1",
	40: "dload_2",
	41: "dload_3",
	42: "aload_0",
	43: "aload_1",
	44: "aload_2",
	45: "aload_3",
	46: "iaload",
	47: "laload",
	48: "faload",
	49: "daload",
	50: "aaload",
	51: "baload",
	52: "caload",
	53: "saload",
	54: "istore",
	55: "lstore",
	56: "fstore",
	57: "dstore",
	58: "astore",
	59: "istore_0",
	60: "istore_1",
	61: "istore_2",
	62: "istore_3",
	63: "lstore_0",
	64: "lstore_1",
	65: "lstore_2",
	66: "lstore_3",
	67: "fstore_0",
	68: "fstore_1",
	69: "fstore_2",
	70: "fstore_3",
	71: "dstore_0",
	72: "dstore_1",
	73: "dstore_2",
	74: "dstore_3",
	75: "astore_0",
	76: "astore_1",
	77: "astore_2",
	78: "astore_3",
	79: "iastore",
	80: "lastore",
	81: "fastore",
	82: "dastore",
	83: "aastore",
	84: "bastore",
	85: "castore",
	86: "sastore",
	87: "pop",
	88: "pop2",
	89: "dup",
	90: "dup_x1",
	91: "dup_x2",
	92: "dup2",
	93: "dup2_x1",
	94: "dup2_x2",
	95: "swap",
	96: "iadd",
	97: "ladd",
	98: "fadd",
	99: "dadd",
	100: "isub",
	101: "lsub",
	102: "fsub",
	103: "dsub",
	104: "imul",
	105: "lmul",
	106: "fmul",
	107: "dmul",
	108: "idiv",
	109: "ldiv",
	110: "fdiv",
	111: "ddiv",
	112: "irem",
	113: "lrem",
	114: "frem",
	115: "drem",
	116: "ineg",
	117: "lneg",
	118: "fneg",
	119: "dneg",
	120: "ishl",
	121: "lshl",
	122: "ishr",
	123: "lshr",
	124: "iushr",
	125: "lushr",
	126: "iand",
	127: "land",
	128: "ior",
	129: "lor",
	130: "ixor",
	131: "lxor",
	132: "iinc",
	133: "i2l",
	134: "i2f",
	135: "i2d",
	136: "l2i",
	137: "l2f",
	138: "l2d",
	139: "f2i",
	140: "f2l",
	141: "f2d",
	142: "d2i",
	143: "d2l",
	144: "d2f",
	145: "i2b",
	146: "i2c",
	147: "i2s",
	148: "lcmp",
	149: "fcmpl",
	150: "fcmpg",
	151: "dcmpl",
	152: "dcmpg",
	153: "ifeq",
	154: "ifne",
	155: "iflt",
	156: "ifge",
	157: "ifgt",
	158: "ifle",
	159: "if_icmpeq",
	160: "if_icmpne",
	161: "if_icmplt",
	162: "if_icmpge",
	163: "if_icmpgt",
	164: "if_icmple",
	165: "if_acmpeq",
	166: "if_acmpne",
	167: "goto",
	168: "jsr†",
	169: "ret†",
	170: "tableswitch",
	171: "lookupswitch",
	172: "ireturn",
	173: "lreturn",
	174: "freturn",
	175: "dreturn",
	176: "areturn",
	177: "return",
	178: "getstatic",
	179: "putstatic",
	180: "getfield",
	181: "putfield",
	182: "invokevirtual",
	183: "invokespecial",
	184: "invokestatic",
	185: "invokeinterface",
	186: "invokedynamic",
	187: "new",
	188: "newarray",
	189: "anewarray",
	190: "arraylength",
	191: "athrow",
	192: "checkcast",
	193: "instanceof",
	194: "monitorenter",
	195: "monitorexit",
	196: "wide",
	197: "multianewarray",
	198: "ifnull",
	199: "ifnonnull",
	200: "goto_w",
	201: "jsr_w†",
	202: "breakpoint",
	254: "impdep1",
	255: "impdep2",
};

const OpcodesById = Object.fromEntries(
	Object.entries(Opcodes).map((v) => [v[1], parseInt(v[0])])
);

/**
 * @type {Record<string, { read: (file: LooseUint8Array) => any }>}
 */
const OpcodesType = {
	aaload: {},
	aastore: {},
	aconst_null: {},
	aload: {
		generate(index) {
			return (file) => {
				file.push_u1(index);
			};
		},
		read(file) {
			return {
				index: file.shift_u1(),
			};
		},
		size() {
			return 1;
		},
	},
	aload_0: {},
	aload_1: {},
	aload_2: {},
	aload_3: {},
	anewarray: {
		generate(index) {
			return (file) => {
				file.push_u2(index);
			};
		},
		read(file) {
			return {
				index: file.shift_u2(),
			};
		},
		size() {
			return 1;
		},
	},
	areturn: {},
	arraylength: {},
	astore: {
		generate(index) {
			return (file) => {
				file.push_u1(index);
			};
		},
		read(file) {
			return {
				index: file.shift_u1(),
			};
		},
		size() {
			return 1;
		},
	},
	astore_0: {},
	astore_1: {},
	astore_2: {},
	astore_3: {},
	athrow: {},
	baload: {},
	bastore: {},
	bipush: {
		generate(byte) {
			return (file) => {
				file.push_u1(byte);
			};
		},
		read(file) {
			return {
				byte: file.shift_u1(),
			};
		},
		size() {
			return 1;
		},
	},
	breakpoint: {},
	caload: {},
	castore: {},
	checkcast: {
		generate(index) {
			return (file) => {
				file.push_u2(index);
			};
		},
		read(file) {
			return {
				index: file.shift_u2(),
			};
		},
		size() {
			return 2;
		},
	},
	d2f: {},
	d2i: {},
	d2l: {},
	dadd: {},
	daload: {},
	dastore: {},
	dcmpg: {},
	dcmpl: {},
	dconst_0: {},
	dconst_1: {},
	ddiv: {},
	dload: {
		generate(index) {
			return (file) => {
				file.push_u1(index);
			};
		},
		read(file) {
			return {
				index: file.shift_u1(),
			};
		},
		size() {
			return 1;
		},
	},
	dload_0: {},
	dload_1: {},
	dload_2: {},
	dload_3: {},
	dmul: {},
	dneg: {},
	drem: {},
	dreturn: {},
	dstore: {
		generate(index) {
			return (file) => {
				file.push_u1(index);
			};
		},
		read(file) {
			return {
				index: file.shift_u1(),
			};
		},
	},
	dstore_0: {},
	dstore_1: {},
	dstore_2: {},
	dstore_3: {},
	dsub: {},
	dup: {},
	dup_x1: {},
	dup_x2: {},
	dup2: {},
	dup2_x1: {},
	dup2_x2: {},
	f2d: {},
	f2i: {},
	f2l: {},
	fadd: {},
	faload: {},
	fastore: {},
	fcmpg: {},
	fcmpl: {},
	fconst_0: {},
	fconst_1: {},
	fconst_2: {},
	fdiv: {},
	fload: {
		generate(index) {
			return (file) => {
				file.push_u1(index);
			};
		},
		read(file) {
			return {
				index: file.shift_u1(),
			};
		},
		size() {
			return 1;
		},
	},
	fload_0: {},
	fload_1: {},
	fload_2: {},
	fload_3: {},
	fmul: {},
	fneg: {},
	frem: {},
	freturn: {},
	fstore: {
		generate(index) {
			return (file) => {
				file.push_u1(index);
			};
		},
		read(file) {
			return { index: file.shift_u1() };
		},
		size() {
			return 1;
		},
	},
	fstore_0: {},
	fstore_1: {},
	fstore_2: {},
	fstore_3: {},
	fsub: {},
	getfield: {
		generate(index) {
			return (file) => {
				file.push_u2(index);
			};
		},
		read(file) {
			return { index: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	getstatic: {
		generate(index) {
			return (file) => {
				file.push_u2(index);
			};
		},
		read(file) {
			return { index: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	goto: {
		generate(index) {
			return (file) => {
				file.push_u2(index);
			};
		},
		read(file) {
			return { index: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	goto_w: {
		generate(index) {
			return (file) => {
				file.push_u4(index);
			};
		},
		read(file) {
			return { index: file.shift_u4() };
		},
		size() {
			return 4;
		},
	},
	i2b: {},
	i2c: {},
	i2d: {},
	i2f: {},
	i2l: {},
	i2s: {},
	iadd: {},
	iaload: {},
	iand: {},
	iastore: {},
	iconst_m1: {},
	iconst_0: {},
	iconst_1: {},
	iconst_2: {},
	iconst_3: {},
	iconst_4: {},
	iconst_5: {},
	idiv: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	if_acmpeq: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	if_acmpne: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	if_icmpeq: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	if_icmpge: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	if_icmpgt: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	if_icmple: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	if_icmplt: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	if_icmpne: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	ifeq: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	ifge: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	ifgt: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	ifle: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	iflt: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	ifne: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	ifnonnull: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	ifnull: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	iinc: {
		generate(index, constant) {
			return (file) => {
				file.push_u1(index);
				file.push_u1(constant);
			};
		},
		read(file) {
			return { index: file.shift_u1(), constant: file.shift_u1() };
		},
		size() {
			return 2;
		},
	},
	iload: {
		generate(index) {
			return (file) => {
				file.push_u1(index);
			};
		},
		read(file) {
			return { index: file.shift_u1() };
		},
		size() {
			return 1;
		},
	},
	iload_0: {},
	iload_1: {},
	iload_2: {},
	iload_3: {},
	impdep1: {},
	impdep2: {},
	imul: {},
	ineg: {},
	instanceof: {
		generate(index) {
			return (file) => {
				file.push_u2(index);
			};
		},
		read(file) {
			return { index: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	invokedynamic: {
		generate(index) {
			return (file) => {
				file.push_u2(index);
				file.push_u1(0);
				file.push_u1(0);
			};
		},
		read(file) {
			let index = file.shift_u2();
			file.shift_u1(); // discard
			file.shift_u1(); // discard
			return { index };
		},
		size() {
			return 4;
		},
	},
	invokeinterface: {
		generate(index, count) {
			return (file) => {
				file.push_u2(index);
				file.push_u1(count);
				file.push_u1(0);
			};
		},
		read(file) {
			let index = file.shift_u2();
			let count = file.shift_u1();
			file.shift_u1(); // discard
			return { index, count };
		},
		size() {
			return 4;
		},
	},
	invokespecial: {
		generate(index) {
			return (file) => {
				file.push_u2(index);
			};
		},
		read(file) {
			return { index: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	invokestatic: {
		generate(index) {
			return (file) => {
				file.push_u2(index);
			};
		},
		read(file) {
			return { index: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	invokevirtual: {
		generate(index) {
			return (file) => {
				file.push_u2(index);
			};
		},
		read(file) {
			return { index: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	ior: {},
	irem: {},
	ireturn: {},
	ishl: {},
	ishr: {},
	istore: {
		generate(index) {
			return (file) => {
				file.push_u1(index);
			};
		},
		read(file) {
			return { index: file.shift_u1() };
		},
		size() {
			return 1;
		},
	},
	istore_0: {},
	istore_1: {},
	istore_2: {},
	istore_3: {},
	isub: {},
	iushr: {},
	ixor: {},
	jsr: {
		generate(branch) {
			return (file) => {
				file.push_u2(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	jsr_w: {
		generate(branch) {
			return (file) => {
				file.push_u4(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u4() };
		},
		size() {
			return 4;
		},
	},
	l2d: {},
	l2f: {},
	l2i: {},
	ladd: {},
	laload: {},
	land: {},
	lastore: {},
	lcmp: {},
	lconst_0: {},
	lconst_1: {},
	ldc: {
		generate(index) {
			return (file) => {
				file.push_u1(index);
			};
		},
		read(file) {
			return { index: file.shift_u1() };
		},
		size() {
			return 1;
		},
	},
	ldc_w: {
		generate(index) {
			return (file) => {
				file.push_u2(index);
			};
		},
		read(file) {
			return { index: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	ldc2_w: {
		generate(index) {
			return (file) => {
				file.push_u2(index);
			};
		},
		read(file) {
			return { index: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	ldiv: {},
	lload: {
		generate(branch) {
			return (file) => {
				file.push_u1(branch);
			};
		},
		read(file) {
			return { branch: file.shift_u1() };
		},
		size() {
			return 1;
		},
	},
	lload_0: {},
	lload_1: {},
	lload_2: {},
	lload_3: {},
	lmul: {},
	lneg: {},
	lookupswitch: {
		read(file) {
			// TODO : implement
			throw new Error("");
		},
	},
	lor: {},
	lrem: {},
	lreturn: {},
	lshl: {},
	lshr: {},
	lstore: {
		generate(index) {
			return (file) => {
				file.push_u1(index);
			};
		},
		read(file) {
			return { index: file.shift_u1() };
		},
		size() {
			return 1;
		},
	},
	lstore_0: {},
	lstore_1: {},
	lstore_2: {},
	lstore_3: {},
	lsub: {},
	lushr: {},
	lxor: {},
	monitorenter: {},
	monitorexit: {},
	multianewarray: {
		generate(index, dimensions) {
			return (file) => {
				file.push_u2(index);
				file.push_u1(dimensions);
			};
		},
		read(file) {
			return { index: file.shift_u2(), dimensions: file.shift_u1() };
		},
		size() {
			return 3;
		},
	},
	new: {
		generate(index) {
			return (file) => {
				file.push_u2(index);
			};
		},
		read(file) {
			return { index: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	newarray: {
		generate(indatypeex) {
			return (file) => {
				file.push_u1(atype);
			};
		},
		read(file) {
			return { atype: file.shift_u1() };
		},
		size() {
			return 1;
		},
	},
	nop: {},
	pop: {},
	pop2: {},
	putfield: {
		generate(index) {
			return (file) => {
				file.push_u2(index);
			};
		},
		read(file) {
			return { index: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	putstatic: {
		generate(index) {
			return (file) => {
				file.push_u2(index);
			};
		},
		read(file) {
			return { index: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	ret: {
		generate(index) {
			return (file) => {
				file.push_u1(index);
			};
		},
		read(file) {
			return { index: file.shift_u1() };
		},
		size() {
			return 1;
		},
	},
	return: {},
	saload: {},
	sastore: {},
	sipush: {
		generate(byte) {
			return (file) => {
				file.push_u2(byte);
			};
		},
		read(file) {
			return { byte: file.shift_u2() };
		},
		size() {
			return 2;
		},
	},
	swap: {},
	tableswitch: {
		read(file) {
			// TODO: implement
			throw new Error("");
		},
	},
	wide: {
		read(file) {
			// TODO: implement
			throw new Error("");
		},
	},
};

function writeAttribute(file, attr) {
	file.push_u2(attr.index); // attribute_name_index
	file.push_u4(attr.size()); // attribute_length
	attr.write(file); // rest
}

/**
 *
 * @param {LooseUint8Array} file
 * @param {*} constants
 */
function readAttribute(file, constants) {
	const attribute_name_index = file.shift_u2();
	let attribute_name = readString(attribute_name_index, constants);
	let attribute_length = file.shift_u4();
	return {
		attribute_name_index,
		attribute_name,
		attribute_length,
		data: Attributes[attribute_name].read(file, constants),
	};
}

function readString(index, constants) {
	let tag = constants[index - 1];
	if (tag.tag != Constants.Constant_Utf8) {
		throw new Error("wrong tag type");
	}
	return tag.data;
}

function readClass(index, constants) {
	let tag = constants[index - 1];
	if (tag.tag != Constants.Constant_Class) {
		throw new Error("wrong tag type");
	}
	return {
		name_index: tag.data.name_index,
		name: readString(tag.data.name_index, constants),
	};
}

/**
 * @typedef Attribute
 * @type {{ index: number, size: () => number, write: (file: LooseUint8Array) => void }}
 */

class ClassFile {
	minor_version = 0;
	major_version = 61;

	/** @type {Array<{ tag: number, write: (file: LooseUint8Array) => void }>} */
	constants = [];

	access_flags = 0;
	this_class_index = 0;
	super_class_index = 0;

	interfaces_indexes = [];

	fields = [];

	methods = [];

	attributes = [];

	constructor() {
		Object.defineProperty(this, "utf8map", { enumerable: false });

		for (const [key, value] of Object.entries(Constants)) {
			ClassFile[`add${key}`] =
				ClassFile.genConstantMethod(value).bind(this);
		}

		for (const key of Object.keys(Attributes)) {
			ClassFile[`createAttribute_${key}`] =
				ClassFile.genAttributeMethod(key).bind(this);
		}

		for (const [key, value] of Object.entries(Opcodes)) {
			ClassFile[`createBytecode_${value}`] =
				ClassFile.genBytecodeMethod(value).bind(this);
		}
	}

	/**
	 *
	 * @param {keyof Constants} tag
	 * @param {(file: LooseUint8Array) => void} write
	 * @returns the index into the constant pool
	 */
	static genConstantMethod(tag) {
		return (...args) => {
			return this.constants.push({
				tag,
				write: ConstantTypes[tag].generate(...args),
			}); // constants pool is 1 indexed, len -> index
		};
	}

	static genAttributeMethod(str) {
		return (...args) => {
			let res = Attributes[str].generate(...args);
			res.index = this.createUtf8(str);
			return res;
		};
	}

	static genBytecodeMethod(str) {
		return (...args) => {
			const op = OpcodesType[str];
			let res =
				typeof op.generate == "function" ? op.generate(...args) : {};
			res.opcode = OpcodesById[str];
			res.name = str;
			return res;
		};
	}

	utf8map = {};

	createUtf8(str) {
		if (!this.utf8map[str]) {
			const c = this.addConstant_Utf8(str);
			this.utf8map[str] = c;
			return c;
		}
		return this.utf8map[str];
	}

	setThisClass(descriptor) {
		this.this_class_index = this.addConstant_Class(
			this.createUtf8(descriptor)
		);
	}

	setSuperClass(descriptor) {
		this.super_class_index = this.addConstant_Class(
			this.createUtf8(descriptor)
		);
	}

	addField_info(access_flags, name_index, descriptor_index, attributes) {
		this.fields.push({
			access_flags,
			name_index,
			descriptor_index,
			attributes,
		});
	}

	addMethod_info(access_flags, name_index, descriptor_index, attributes) {
		this.fields.push({
			access_flags,
			name_index,
			descriptor_index,
			attributes,
		});
	}

	createExceptionHandler(start_pc, end_pc, handler_pc, catch_type) {
		return { start_pc, end_pc, handler_pc, catch_type };
	}

	createInnerClass(
		inner_class_info_index,
		outer_class_info_index,
		inner_name_index,
		inner_class_access_flags
	) {
		return {
			inner_class_info_index,
			outer_class_info_index,
			inner_name_index,
			inner_class_access_flags,
		};
	}

	createLineNumber(start_pc, line_number) {
		return { start_pc, line_number };
	}

	createLocalVariableDescriptor(
		start_pc,
		length,
		name_index,
		descriptor_index,
		index
	) {
		return {
			start_pc,
			length,
			name_index,
			descriptor_index,
			index,
		};
	}

	createLocalVariableSignature(
		start_pc,
		length,
		name_index,
		signature_index,
		index
	) {
		return {
			start_pc,
			length,
			name_index,
			signature_index,
			index,
		};
	}

	createBootstrapMethod(bootstrap_method_ref, bootstrap_arguments) {
		return { bootstrap_method_ref, bootstrap_arguments };
	}

	createParameters(name_index, access_flags) {
		return { name_index, access_flags };
	}

	generate() {
		let file = new LooseUint8Array();

		// magic bytes
		file.push_u4(0xcafebabe);

		// minor
		file.push_u2(0); // Any version

		// major
		file.push_u2(61); // Java SE 17

		// constants
		file.push_u2(this.constants.length + 1);
		for (const c of this.constants) {
			file.push_u1(c.tag);
			c.write(file);
		}

		file.push_u2(this.access_flags);
		file.push_u2(this.this_class_index);
		file.push_u2(this.super_class_index);

		// interfaces
		file.push_u2(this.interfaces_indexes.length);
		for (const i of this.interfaces_indexes) {
			file.push_u2(i);
		}

		// field info
		file.push_u2(this.fields.length);
		for (const f of this.fields) {
			file.push_u2(f.access_flags);
			file.push_u2(f.name_index);
			file.push_u2(f.descriptor_index);
			file.push_u2(f.attributes.length);
			for (const a of f.attributes) {
				writeAttribute(file, a);
			}
		}

		// method info
		file.push_u2(this.methods.length);
		for (const m of this.methods) {
			file.push_u2(m.access_flags);
			file.push_u2(m.name_index);
			file.push_u2(m.descriptor_index);
			file.push_u2(m.attributes.length);
			for (const a of m.attributes) {
				writeAttribute(file, a);
			}
		}

		// attribute info
		file.push_u2(this.attributes.length);
		for (const a of this.attributes) {
			writeAttribute(file, a);
		}

		return Buffer.from(file);
	}

	read(file) {
		if (file.shift_u4() != 0xcafebabe) throw 0;

		this.minor_version = file.shift_u2();
		this.major_version = file.shift_u2();

		let constant_pool_length = file.shift_u2() - 1;
		let constants = [];
		for (let i = 0; i < constant_pool_length; i++) {
			const tag = file.shift_u1();
			constants.push({
				index: i,
				tag,
				name: ConstantsById[tag],
				data: ConstantTypes[tag].read(file),
			});
		}
		this.constants = constants;

		this.access_flags = file.shift_u2();
		this.this_class_index = file.shift_u2();
		this.this_class = readClass(this.this_class_index, constants);
		this.super_class_index = file.shift_u2();
		this.super_class = readClass(this.super_class_index, constants);

		let interfaces_count = file.shift_u2();
		let interfaces = [];
		for (let i = 0; i < interfaces_count; i++) {
			interfaces.push(file.shift_u2());
		}
		this.interfaces_indexes = interfaces;
		this.interfaces = interfaces.map((v) => readString(v, constants));

		let fields_count = file.shift_u2();
		let fields = [];
		for (let i = 0; i < fields_count; i++) {
			let field = {
				access_flags: file.shift_u2(),
				name_index: file.shift_u2(),
				descriptor_index: file.shift_u2(),
			};
			field.name = readString(field.name_index, constants);
			field.descriptor = readString(field.descriptor_index, constants);

			let attributes_length = file.shift_u2();
			let attributes = [];
			for (let j = 0; j < attributes_length; j++) {
				attributes.push(readAttribute(file, constants));
			}
			field.attributes = attributes;

			fields.push(field);
		}
		this.fields = fields;

		let methods_count = file.shift_u2();
		let methods = [];
		for (let i = 0; i < methods_count; i++) {
			let method = {
				access_flags: file.shift_u2(),
				name_index: file.shift_u2(),
				descriptor_index: file.shift_u2(),
			};
			method.name = readString(method.name_index, constants);
			method.descriptor = readString(method.descriptor_index, constants);

			let attributes_length = file.shift_u2();
			let attributes = [];
			for (let j = 0; j < attributes_length; j++) {
				attributes.push(readAttribute(file, constants));
			}
			method.attributes = attributes;

			methods.push(method);
		}
		this.methods = methods;

		let attributes_length = file.shift_u2();
		let attributes = [];
		for (let j = 0; j < attributes_length; j++) {
			attributes.push(readAttribute(file, constants));
		}
		this.attributes = attributes;
	}
}

let file = fs.readFileSync("./samples/HelloWorld.class");
const data = new LooseUint8Array();
data.from(file);
const classFile = new ClassFile();
classFile.read(data);
fs.writeFileSync(
	"./samples/HelloWorld.class.json",
	JSON.stringify(classFile, (k, v) => (v instanceof ArrayBuffer ? [...v] : v))
);

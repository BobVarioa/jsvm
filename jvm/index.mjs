import fs from "node:fs";
import os from "node:os";

const ENDIANNESS = os.endianness();

export class LooseUint8Array {
	data;
	view;
	size;
	offset = 0;

	constructor() {
		this.size = 8;
		this.data = new ArrayBuffer(this.size, { maxByteLength: 2 ** 32 });
		this.view = new DataView(this.data);
	}

	/**
	 *
	 * @param {Buffer} buffer
	 */
	fromBuffer(buffer) {
		this.resize(buffer.byteLength);
		for (let i = 0; i < buffer.byteLength; i++) {
			this.view.setUint8(i, buffer.readUInt8(i));
		}
	}

	toBuffer() {
		let buff = Buffer.alloc(this.offset);
		for (let i = 0; i < this.offset; i++) {
			buff.writeUInt8(this.view.getUint8(i), i);
		}
		return buff;
	}

	resize(n) {
		this.data.resize(n);
		this.size = n;
	}

	push_u1(...bytes) {
		for (let i = 0; i < bytes.length; i++) {
			if (this.offset + 1 >= this.size) {
				this.resize(this.size * 2);
			}
			this.view.setUint8(this.offset, bytes[i]);
			this.offset++;
		}
	}

	push_u2(...bytes) {
		for (let i = 0; i < bytes.length; i++) {
			if (this.offset + 2 >= this.size) {
				this.resize(this.size * 2);
			}
			this.view.setUint16(this.offset, bytes[i]);
			this.offset += 2;
		}
	}

	push_u4(...bytes) {
		for (let i = 0; i < bytes.length; i++) {
			if (this.offset + 4 >= this.size) {
				this.resize(this.size * 2);
			}
			this.view.setUint32(this.offset, bytes[i]);
			this.offset += 4;
		}
	}

	rev_offset = 0;

	shift_u1() {
		let byte = this.view.getUint8(this.rev_offset);
		this.rev_offset++;
		return byte;
	}

	shift_s1() {
		let byte = this.view.getInt8(this.rev_offset);
		this.rev_offset++;
		return byte;
	}

	shift_u2() {
		let byte = this.view.getUint16(this.rev_offset);
		this.rev_offset += 2;
		return byte;
	}

	shift_s2() {
		let byte = this.view.getInt16(this.rev_offset);
		this.rev_offset += 2;
		return byte;
	}

	shift_u4() {
		let byte = this.view.getUint32(this.rev_offset);
		this.rev_offset += 4;
		return byte;
	}

	shift_s4() {
		let byte = this.view.getInt32(this.rev_offset);
		this.rev_offset += 4;
		return byte;
	}

	shift_bytes(n) {
		let arr = [...this.view.slice(this.rev_offset, this.rev_offset + n)];
		this.rev_offset += n;
		return arr;
	}
}

export const ReferenceKind = /** @type {const} */ ({
	getField: 1,
	getStatic: 2,
	putField: 3,
	putStatic: 4,
	invokeVirtual: 5,
	invokeStatic: 6,
	invokeSpecial: 7,
	newInvokeSpecial: 8,
	invokeInterface: 9,
});

const ReferenceKindById = Object.fromEntries(
	Object.entries(ReferenceKind).map((v) => [v[1], v[0]])
);

export const AccessFlags = {
	File_Public: 0x0001,
	File_Final: 0x0010,
	File_Super: 0x0020,
	File_Interface: 0x0200,
	File_Abstract: 0x0400,
	File_Synthetic: 0x1000,
	File_Annotation: 0x2000,
	File_Enum: 0x4000,

	Class_Public: 0x0001,
	Class_Private: 0x0002,
	Class_Protected: 0x0004,
	Class_Static: 0x0008,
	Class_Final: 0x0010,
	Class_Interface: 0x0200,
	Class_Abstract: 0x0400,
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
	Method_Native: 0x0100,
	Method_Abstract: 0x0400,
	Method_Strict: 0x0800,
	Method_Synthetic: 0x1000,
};

const Constants = {
	Class: 7,
	Fieldref: 9,
	Methodref: 10,
	InterfaceMethodref: 11,
	String: 8,
	Integer: 3,
	Float: 4,
	Long: 5,
	Double: 6,
	NameAndType: 12,
	Utf8: 1,
	MethodHandle: 15,
	MethodType: 16,
	InvokeDynamic: 18,
};

const ConstantsById = Object.fromEntries(
	Object.entries(Constants).map((v) => [v[1], v[0]])
);

/**
 * @type {Record<number, {generate: (...args) => ((file: LooseUint8Array) => void), read: (file: LooseUint8Array) => any}>}
 */
const ConstantTypes = {
	[Constants.Class]: {
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
	[Constants.Fieldref]: {
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
	[Constants.Methodref]: {
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
	[Constants.InterfaceMethodref]: {
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
	[Constants.String]: {
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
	[Constants.Integer]: {
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
	[Constants.Float]: {
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
	[Constants.Double]: {
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
	[Constants.NameAndType]: {
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
	[Constants.Utf8]: {
		// prettier-ignore
		generate(str) {
			return (file) => {
				let code = Array.from(str).map((v) => v.codePointAt(0));
				let rep = []

				for (let i = 0; i < code.length; i++) {
					const pt = code[i];
					
					if (0x01 <= pt && pt <= 0x7f) {
						rep.push(0b0000_0000 | (pt & 0b0000_0000_0111_1111)) // 6-0
					} else if (0x80 <= pt && pt <= 0x7ff) {
						rep.push(0b1100_0000 | (pt & 0b0000_0111_1100_0000)) // 10-6
						rep.push(0b1000_0000 | (pt & 0b0000_0000_0011_1111)) // 5-0
					} else if (0x800 <= pt && pt <= 0xffff) {
						rep.push(0b1110_0000 | (pt & 0b1111_0000_0000_0000)) // 15-12
						rep.push(0b1000_0000 | (pt & 0b0000_1111_1100_0000)) // 11-6
						rep.push(0b1000_0000 | (pt & 0b0000_0000_0011_1111)) // 5-0
					} else if (0xffff <= pt) {
						rep.push(0b1110_1101) // marker
						rep.push(0b1010_0000 | ((pt & 0b0000_0000_0001_1111_0000_0000_0000_0000)) - 1) // 20-16
						rep.push(0b1000_0000 |  (pt & 0b0000_0000_0000_0000_1111_1100_0000_0000))       // 15-10
						rep.push(0b1110_1101) // marker
						rep.push(0b1010_0000 |  (pt & 0b0000_0000_0000_0000_0000_0011_1100_0000))       // 9-6
						rep.push(0b1000_0000 |  (pt & 0b0000_0000_0000_0000_0000_0000_0011_1111))       // 5-0
					}
				}
				
				file.push_u2(rep.length);
				file.push_u1(...rep);
			};
		},
		// prettier-ignore
		read(file) {
			let length = file.shift_u2();
			let arr = [];
			for (let i = 0; i < length; i++) {
				const code = file.shift_u1();

				if (code <= 0b0111_1111) {
					arr.push(code)
				} else if ((code >> 5) == 0b110) {
					let x = code           ;
					let y = file.shift_u1();
					i += 1;
					
					arr.push(((x & 0x1f) << 6) + (y & 0x3f))
				} else if ((code >> 4) == 0b1110) {
					let x = code           ;
					let y = file.shift_u1();
					let z = file.shift_u1();
					i += 2;
					
					arr.push(((x & 0xf) << 12) + ((y & 0x3f) << 6) + (z & 0x3f))
				} else if (code == 0b1110_1101) {
					let u = code           ;
					let v = file.shift_u1();
					let w = file.shift_u1();
					let x = file.shift_u1();
					let y = file.shift_u1();
					let z = file.shift_u1();
					i += 5;

					if (u != 0b1110_1101 || x != 0b1110_1101) throw new Error();

					arr.push(0x10000 + ((v & 0x0f) << 16) + ((w & 0x3f) << 10) + ((y & 0x0f) << 6) + (z & 0x3f))
				}
			}
			return Array.from(arr)
				.map((v) => String.fromCodePoint(v))
				.join("");
		},
	},
	[Constants.MethodHandle]: {
		generate(reference_kind, reference_index) {
			return (file) => {
				file.push_u1(ReferenceKind[reference_kind]);
				file.push_u2(reference_index);
			};
		},
		read(file) {
			const ref = {
				reference_kind: file.shift_u1(),
				reference_index: file.shift_u2(),
			};
			ref.reference_kind_name = ReferenceKindById[ref.reference_kind];
			return ref;
		},
	},
	[Constants.MethodType]: {
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
	[Constants.InvokeDynamic]: {
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

export const StackMapTable = /** @type {const} */({
	SAME: "SAME",
	SAME_LOCALS_1_STACK_ITEM: "SAME_LOCALS_1_STACK_ITEM",
	SAME_LOCALS_1_STACK_ITEM_EXTENDED: "SAME_LOCALS_1_STACK_ITEM_EXTENDED",
	CHOP: "CHOP",
	SAME_FRAME_EXTENDED: "SAME_FRAME_EXTENDED",
	APPEND: "APPEND",
	FULL_FRAME: "FULL_FRAME",
});

export const VerificationTypeInfo = /** @type {const} */ ({
	Top: 0,
	Integer: 1,
	Float: 2,
	Null: 5,
	UninitializedThis: 6,
	Object: 7,
	Uninitialized: 8,
	Long: 4,
	Double: 3,
});

const VerificationTypeInfoById = Object.fromEntries(
	Object.entries(VerificationTypeInfo).map((v) => [v[1], v[0]])
);

/**
 *
 * @param {LooseUint8Array} file
 */
function readVerificationTypeInfo(file) {
	let obj = {};
	let tag = file.shift_u1();

	switch (tag) {
		case VerificationTypeInfo.Top:
		case VerificationTypeInfo.Integer:
		case VerificationTypeInfo.Float:
		case VerificationTypeInfo.Null:
		case VerificationTypeInfo.UninitializedThis:
		case VerificationTypeInfo.Long:
		case VerificationTypeInfo.Double:
			obj.tag = VerificationTypeInfoById[tag];
			break;
		case VerificationTypeInfo.Object:
			obj.tag = VerificationTypeInfo.Object;
			obj.cpool_index = file.shift_u2();
			break;
		case VerificationTypeInfo.Uninitialized:
			obj.tag = VerificationTypeInfo.Uninitialized;
			obj.offset = file.shift_u2();
			break;
		default:
			throw new Error();
	}

	return obj;
}

/**
 *
 * @param {LooseUint8Array} file
 * @param {*} obj
 */
function writeVerificationTypeInfo(file, obj) {
	let tag = VerificationTypeInfo[obj.tag];

	switch (tag) {
		case VerificationTypeInfo.Top:
		case VerificationTypeInfo.Integer:
		case VerificationTypeInfo.Float:
		case VerificationTypeInfo.Null:
		case VerificationTypeInfo.UninitializedThis:
		case VerificationTypeInfo.Long:
		case VerificationTypeInfo.Double:
			file.push_u1(tag);
			break;
		case VerificationTypeInfo.Object:
			file.push_u1(tag);
			file.push_u2(obj.cpool_index);
			break;
		case VerificationTypeInfo.Uninitialized:
			file.push_u1(tag);
			file.push_u2(obj.offset);
			break;
		default:
			throw new Error();
	}
}

function sizeVerificationTypeInfo(obj) {
	let tag = VerificationTypeInfo[obj.tag];

	switch (tag) {
		case VerificationTypeInfo.Top:
		case VerificationTypeInfo.Integer:
		case VerificationTypeInfo.Float:
		case VerificationTypeInfo.Null:
		case VerificationTypeInfo.UninitializedThis:
		case VerificationTypeInfo.Long:
		case VerificationTypeInfo.Double:
			return 1;
		case VerificationTypeInfo.Object:
			return 3;
		case VerificationTypeInfo.Uninitialized:
			return 3;
		default:
			throw new Error();
	}
}

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
						// exception table length
						2 +
						// exception table
						8 * exception_table.length +
						// attributes length
						2;
					for (const c of code) {
						size += 1 + c.size;
					}

					for (const a of attributes) {
						size += 6 + a.size();
					}
					return size;
				},
				write(file) {
					file.push_u2(max_stack);
					file.push_u2(max_locals);

					file.push_u4(code.reduce((p, v) => p + 1 + v.size, 0));
					for (const c of code) {
						file.push_u1(c.opcode);
						if (c.write) {
							c.write(file);
						}
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
				obj.i = i;
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
		generate(entries) {
			return {
				size() {
					let size = 2;
					for (let i = 0; i < entries.length; i++) {
						const frame = entries[i];

						switch (frame.frame_type) {
							case StackMapTable.SAME:
								size += 1;
								break;
							case StackMapTable.SAME_LOCALS_1_STACK_ITEM:
								size += 1;
								size += sizeVerificationTypeInfo(
									frame.verification_type_info
								);
								break;
							case StackMapTable.SAME_LOCALS_1_STACK_ITEM_EXTENDED:
								size += 3;
								size += sizeVerificationTypeInfo(
									frame.verification_type_info
								);
								break;
							case StackMapTable.CHOP:
								size += 3;
								break;
							case StackMapTable.SAME_FRAME_EXTENDED:
								size += 3;
								break;
							case StackMapTable.APPEND:
								size += 3;
								for (let i = 0; i < frame.k; i++) {
									size += sizeVerificationTypeInfo(
										frame.locals[i]
									);
								}
								break;
							case StackMapTable.FULL_FRAME:
								size += 5;
								for (let i = 0; i < frame.locals.length; i++) {
									size += sizeVerificationTypeInfo(
										frame.locals[i]
									);
								}
								size += 2;
								for (let i = 0; i < frame.stack.length; i++) {
									size += sizeVerificationTypeInfo(
										frame.stack[i]
									);
								}
								break;
							default:
								throw new Error();
						}
					}
					return size;
				},
				write(file) {
					file.push_u2(entries.length);
					for (let i = 0; i < entries.length; i++) {
						const frame = entries[i];

						switch (frame.frame_type) {
							case StackMapTable.SAME:
								file.push_u1(frame.offset_delta);
								break;
							case StackMapTable.SAME_LOCALS_1_STACK_ITEM:
								file.push_u1(frame.offset_delta + 64);
								writeVerificationTypeInfo(
									file,
									frame.verification_type_info
								);
								break;
							case StackMapTable.SAME_LOCALS_1_STACK_ITEM_EXTENDED:
								file.push_u1(247);
								file.push_u2(frame.offset_delta);
								writeVerificationTypeInfo(
									file,
									frame.verification_type_info
								);
								break;
							case StackMapTable.CHOP:
								file.push_u1(248 + frame.k);
								file.push_u2(frame.offset_delta);
								break;
							case StackMapTable.SAME_FRAME_EXTENDED:
								file.push_u1(251);
								file.push_u2(frame.offset_delta);
								break;
							case StackMapTable.APPEND:
								file.push_u1(251 + frame.k);
								file.push_u2(frame.offset_delta);
								for (let i = 0; i < frame.k; i++) {
									writeVerificationTypeInfo(
										file,
										frame.locals[i]
									);
								}
								break;
							case StackMapTable.FULL_FRAME:
								file.push_u1(255);
								file.push_u2(frame.offset_delta);
								file.push_u2(frame.locals.length);
								for (let i = 0; i < frame.locals.length; i++) {
									writeVerificationTypeInfo(
										file,
										frame.locals[i]
									);
								}
								file.push_u2(frame.stack.length);
								for (let i = 0; i < frame.stack.length; i++) {
									writeVerificationTypeInfo(
										file,
										frame.stack[i]
									);
								}
								break;
							default:
								throw new Error();
						}
					}
				},
			};
		},
		read(file, constants) {
			let entries_length = file.shift_u2();
			let entries = [];

			for (let i = 0; i < entries_length; i++) {
				const frame_type = file.shift_u1();
				let obj = {};

				if (frame_type >= 0 && frame_type <= 63) {
					obj.frame_type = StackMapTable.SAME;
					obj.offset_delta = frame_type;
				} else if (frame_type >= 64 && frame_type <= 127) {
					obj.frame_type = StackMapTable.SAME_LOCALS_1_STACK_ITEM;
					obj.offset_delta = frame_type - 64;
					obj.verification_type_info = readVerificationTypeInfo(file);
				} else if (frame_type == 247) {
					obj.frame_type =
						StackMapTable.SAME_LOCALS_1_STACK_ITEM_EXTENDED;
					obj.offset_delta = file.shift_u2();
					obj.verification_type_info = readVerificationTypeInfo(file);
				} else if (frame_type >= 248 && frame_type <= 250) {
					obj.frame_type = StackMapTable.CHOP;
					obj.k = 251 - frame_type;
					obj.offset_delta = file.shift_u2();
				} else if (frame_type == 251) {
					obj.frame_type = StackMapTable.SAME_FRAME_EXTENDED;
					obj.offset_delta = file.shift_u2();
				} else if (frame_type >= 252 && frame_type <= 254) {
					obj.frame_type = StackMapTable.APPEND;
					let k = frame_type - 251;
					obj.offset_delta = file.shift_u2();
					let locals = [];
					for (let i = 0; i < k; i++) {
						locals.push(readVerificationTypeInfo(file));
					}
					obj.locals = locals;
				} else if (frame_type == 255) {
					obj.frame_type = StackMapTable.FULL_FRAME;
					obj.offset_delta = file.shift_u2();
					let number_of_locals = file.shift_u2();
					let locals = [];
					for (let i = 0; i < number_of_locals; i++) {
						locals.push(readVerificationTypeInfo(file));
					}
					obj.locals = locals;

					let number_of_stack_items = file.shift_u2();
					let stack = [];
					for (let i = 0; i < number_of_stack_items; i++) {
						stack.push(readVerificationTypeInfo(file));
					}
					obj.stack = stack;
				}

				entries.push(obj);
			}

			return entries;
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
						file.push_u2(c.inner_class_info_index);
						file.push_u2(c.outer_class_info_index);
						file.push_u2(c.inner_name_index);
						file.push_u2(c.inner_class_access_flags);
					}
				},
			};
		},
		read(file, constants) {
			let classes_len = file.shift_u2();
			let classes = [];
			for (let i = 0; i < classes_len; i++) {
				const clazz = {
					inner_class_info_index: file.shift_u2(),
					outer_class_info_index: file.shift_u2(),
					inner_name_index: file.shift_u2(),
					inner_class_access_flags: file.shift_u2(),
				};
				if (clazz.inner_class_info_index != 0)
					clazz.inner_class_info = readClass(
						clazz.inner_class_info_index,
						constants
					);
				if (clazz.outer_class_info_index != 0)
					clazz.outer_class_info = readClass(
						clazz.outer_class_info_index,
						constants
					);
				if (clazz.inner_name_index != 0)
					clazz.inner_name = readString(
						clazz.inner_name_index,
						constants
					);

				classes.push(clazz);
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

			return bootstrap_methods;
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

const Opcodes = /** @type {const} */ ({
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
});

const OpcodesById = Object.fromEntries(
	Object.entries(Opcodes).map((v) => [v[1], parseInt(v[0])])
);

/**
 * @type {Record<Opcodes[keyof Opcodes], { read: (file: LooseUint8Array) => any }>}
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
			return { index: file.shift_s2() };
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
			return { index: file.shift_s4() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { branch: file.shift_s2() };
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
			return { index: file.shift_u1(), constant: file.shift_s1() };
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
	if (tag.tag != Constants.Utf8) {
		throw new Error("wrong tag type");
	}
	return tag.data;
}

function readClass(index, constants) {
	let tag = constants[index - 1];
	if (tag.tag != Constants.Class) {
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

/**
 *
 * @template T
 * @param {T} obj
 * @param {keyof T} key
 */
function declareCached(obj, key) {
	/**
	 * @type {Function<any, any>}
	 */
	const method = obj[key];
	const cache = new Map();

	obj[key] = (...args) => {
		let json = JSON.stringify(args); // 😬
		let value = cache.get(json);
		if (value != undefined) {
			return value;
		}
		value = method.apply(obj, args);
		cache.set(json, value);
		return value;
	};
}

export class ClassFile {
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
		declareCached(this, "createUtf8");
		declareCached(this, "createClassInfo");
		declareCached(this, "createNameAndType");
		declareCached(this, "createFieldRef");
		declareCached(this, "createMethodRef");
		declareCached(this, "createString");
		declareCached(this, "createMethodHandle");
		declareCached(this, "createInvokeDynamic");
	}

	/**
	 *
	 * @param {keyof Constants} id
	 * @param  {...any} args
	 * @returns
	 */
	addConstant(id, ...args) {
		return this.constants.push({
			name: id,
			tag: Constants[id],
			index: this.constants.length + 1,
			write: ConstantTypes[Constants[id]].generate(...args),
		}); // constants pool is 1 indexed, len -> index
	}

	/**
	 *
	 * @param {keyof Attributes} id
	 * @param  {...any} args
	 * @returns
	 */
	createAttribute(id, ...args) {
		let res = Attributes[id].generate(...args);
		res.index = this.createUtf8(id);
		return res;
	}

	/**
	 *
	 * @param {Opcodes[keyof Opcodes]} id
	 * @param  {...any} args
	 * @returns
	 */
	createBytecode(id, ...args) {
		const op = OpcodesType[id];
		let res =
			typeof op.generate == "function"
				? { write: op.generate(...args) }
				: {};
		res.opcode = OpcodesById[id];
		res.name = id;
		res.size = op.size ? op.size() : 0;
		return res;
	}

	createUtf8(str) {
		return this.addConstant("Utf8", str);
	}

	setThisClass(descriptor) {
		this.this_class_index = this.createClassInfo(descriptor);
		this.this_class = descriptor;
	}

	setSuperClass(descriptor) {
		this.super_class_index = this.createClassInfo(descriptor);
		this.super_class = descriptor;
	}

	addField(access_flags, name_index, descriptor_index, attributes) {
		this.fields.push({
			access_flags,
			name_index,
			descriptor_index,
			attributes,
		});
	}

	addMethodRaw(access_flags, name_index, descriptor_index, attributes) {
		this.methods.push({
			access_flags,
			name_index,
			descriptor_index,
			attributes,
		});
	}

	addMethod(access_flags, name, retType, args, attrs) {
		this.methods.push({
			access_flags,
			name_index: this.createUtf8(name),
			descriptor_index: this.createUtf8(
				this.createMethodDescriptor(retType, args)
			),
			attributes: attrs,
		});
	}

	createExceptionHandler(start_pc, end_pc, handler_pc, catch_type) {
		return { start_pc, end_pc, handler_pc, catch_type };
	}

	inner_classes = [];

	addInnerClass(
		outer_class_name,
		inner_class_name,
		inner_class_access_flags
	) {
		const clazz = {
			inner_class_info_index: this.createClassInfo(
				outer_class_name + "$" + inner_class_name
			),
			outer_class_info_index: this.createClassInfo(outer_class_name),
			inner_name_index: this.createUtf8(inner_class_name),
			inner_class_access_flags,
		};
		return this.inner_classes.push(clazz) - 1;
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

	createFieldDescriptor(str) {
		switch (str) {
			case "byte":
				return "B";
			case "char":
				return "C";
			case "double":
				return "D";
			case "float":
				return "F";
			case "int":
				return "I";
			case "long":
				return "J";
			case "short":
				return "S";
			case "boolean":
				return "Z";
			case "void":
				return "V";
			default: {
				if (str.endsWith("[]")) {
					return "[" + this.createFieldDescriptor(str.slice(0, -2));
				}
				return "L" + str.replaceAll(".", "/") + ";";
			}
		}
	}

	createMethodDescriptor(retType, args) {
		let str = "(";
		for (let i = 0; i < args.length; i++) {
			str += this.createFieldDescriptor(args[i]);
		}
		str += ")";
		str += this.createFieldDescriptor(retType);
		return str;
	}

	createClassInfo(str) {
		return this.addConstant(
			"Class",
			this.createUtf8(str.replaceAll(".", "/"))
		);
	}

	createNameAndType(name, type) {
		return this.addConstant(
			"NameAndType",
			this.createUtf8(name.replaceAll(".", "/")),
			this.createUtf8(type)
		);
	}

	createCode(max_stack, max_locals, code, attributes = []) {
		return this.createAttribute(
			"Code",
			max_stack,
			max_locals,
			code,
			[],
			attributes
		);
	}

	createFieldRef(clazz, name, type) {
		return this.addConstant(
			"Fieldref",
			this.createClassInfo(clazz),
			this.createNameAndType(name, this.createFieldDescriptor(type))
		);
	}

	createMethodRef(clazz, name, retType, args) {
		return this.addConstant(
			"Methodref",
			this.createClassInfo(clazz),
			this.createNameAndType(
				name,
				this.createMethodDescriptor(retType, args)
			)
		);
	}

	createString(str) {
		return this.addConstant("String", this.createUtf8(str));
	}

	/**
	 *
	 * @param {keyof ReferenceKind} reference_kind
	 * @param {number} reference_index
	 * @returns
	 */
	createMethodHandle(reference_kind, reference_index) {
		return this.addConstant(
			"MethodHandle",
			reference_kind,
			reference_index
		);
	}

	/**
	 * 
	 * @param {keyof VerificationTypeInfo} tag 
	 * @param {string} type 
	 * @returns 
	 */
	createVerficationType(tag, type) {
		let ret = { tag }
		if (type) {
			if (type.endsWith("[]")) {
				ret.cpool_index = this.addConstant(
					"Class",
					this.createUtf8(this.createFieldDescriptor(type))
				);
			} else {
				ret.cpool_index = this.createClassInfo(type);
			}
		}
		return ret;
	}

	bootstrap_methods = [];

	/**
	 *
	 * @param {string} name
	 * @param {string} retType
	 * @param {string[]} args
	 * @param {keyof ReferenceKind} reference_kind
	 * @param {string} class_name
	 * @param {string} method_name
	 * @param {string} retType2
	 * @param {string[]} args2
	 * @param {number[]} bootstrap_arguments
	 * @returns
	 */
	createInvokeDynamic(
		name,
		retType,
		args,
		reference_kind,
		class_name,
		method_name,
		retType2,
		args2,
		bootstrap_arguments
	) {
		let index = this.bootstrap_methods.push({
			bootstrap_method_ref: this.createMethodHandle(
				reference_kind,
				this.createMethodRef(class_name, method_name, retType2, args2)
			),
			bootstrap_arguments,
		});

		return this.addConstant(
			"InvokeDynamic",
			index - 1,
			this.createNameAndType(
				name,
				this.createMethodDescriptor(retType, args)
			)
		);
	}

	addAttribute(attr) {
		this.attributes.push(attr);
	}

	/**
	 * 
	 * @param {keyof StackMapTable} frameType 
	 * @param {*} offset_delta 
	 * @param {*} locals 
	 * @param {*} stack 
	 */
	createStackMapFrame(frameType, offset_delta, locals, stack) {
		return {frame_type: StackMapTable[frameType], offset_delta, locals, stack}
	}

	generate() {
		let file = new LooseUint8Array();

		if (this.bootstrap_methods.length > 0) {
			this.addAttribute(
				this.createAttribute("BootstrapMethods", this.bootstrap_methods)
			);
		}

		if (this.inner_classes.length > 0) {
			this.addAttribute(
				this.createAttribute("InnerClasses", this.inner_classes)
			);
		}

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

		return file.toBuffer();
	}

	read(file) {
		if (file.shift_u4() != 0xcafebabe) throw 0;

		this.minor_version = file.shift_u2();
		this.major_version = file.shift_u2();

		let pool_length = file.shift_u2() - 1;
		let constants = [];
		for (let i = 0; i < pool_length; i++) {
			const tag = file.shift_u1();
			constants.push({
				index: i + 1,
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

	toJson() {
		return JSON.stringify(this, (k, v) =>
			v instanceof ArrayBuffer ? [...v] : v
		);
	}
}

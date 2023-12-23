package jvm.lib;

public abstract class JSFunction extends JSObject {
	private final String name;

	public JSFunction(String name) {
		this.name = name;
	}

	public abstract void call(Realm scope, JSObject args[]);

	public String toString() {
		// TODO: ehh i don't think this is completely correct but wtv
		return "function " + name + "() { [native code] }";
	}
}
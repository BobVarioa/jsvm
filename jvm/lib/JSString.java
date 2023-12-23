package jvm.lib;

public class JSString extends JSObject {
	private final String value;

	public JSString(String value) {
		this.value = value;
	}

	public String value() {
		return this.value;
	}

	@Override
	public String toString() {
		return this.value;
	}
}
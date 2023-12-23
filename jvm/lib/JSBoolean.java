package jvm.lib;

public class JSBoolean extends JSObject {
	private final Boolean value;

	public JSBoolean(Boolean value) {
		this.value = value;
	}

	public Boolean value() {
		return this.value;
	}

	@Override
	public String toString() {
		return this.value ? "true" : "false";
	}
}
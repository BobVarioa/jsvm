package jvm.lib;

public class JSObject {
	// TODO: technically Symbol#toStringTag
	public String toStringTag = "object";

	public String toString() {
		return "[Object " + toStringTag + "]";
	}
}
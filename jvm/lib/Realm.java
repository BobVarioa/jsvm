package jvm.lib;

import java.util.Map;
import java.util.HashMap;

public class Realm {
	private Map<String, JSObject> scope = new HashMap<>();

	public Realm() {}

	public void initializeRealm() {
		scope.put("print", new PrintCallback());
		scope.put("assert", new AssertCallback());
	}

	public JSObject get(String str) {
		return scope.get(str);
	}

	public void set(String str, JSObject obj) {
		scope.put(str, obj);
	}
}

package jvm.lib;

public class AssertCallback extends JSFunction {
	public AssertCallback() {
		super("print");
	}

	@Override
	public void call(Realm scope, JSObject args[]) {
		if (args[0] instanceof JSBoolean bool) {
			if (!bool.value()) {
				// TODO: throw actual error
				if (args[1] instanceof JSString str) {
					System.err.println("AssertionError: " + str.value());
				} else {
					System.err.println("AssertionError");
				}
				System.exit(0);
			}
		} else {
			System.err.println("Wrong type of argument");
			System.exit(0);
		}

	}
}
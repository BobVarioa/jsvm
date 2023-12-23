package jvm.lib;

public class PrintCallback extends JSFunction {
	public PrintCallback() {
		super("print");
	}

	@Override
	public void call(Realm scope, JSObject args[]) {
		StringBuilder sb = new StringBuilder();
		for (int i = 0; i < args.length; i++) {
			if (i != 0)
				sb.append("\t");
			sb.append(args[i].toString());
		}
		System.out.println(sb.toString());
	}
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname !== "/calc") {
      return new Response("Not Found", { status: 404 });
    }

    const op = url.searchParams.get("op");
    const a = parseFloat(url.searchParams.get("a"));
    const b = parseFloat(url.searchParams.get("b"));

    if (isNaN(a) || isNaN(b)) {
      return new Response("Invalid numbers", { status: 400 });
    }

    let result;
    switch (op) {
      case "add":
        result = a + b;
        break;
      case "sub":
        result = a - b;
        break;
      case "mul":
        result = a * b;
        break;
      case "div":
        if (b === 0) {
          return new Response("Cannot divide by zero", { status: 400 });
        }
        result = a / b;
        break;
      default:
        return new Response("Invalid operation", { status: 400 });
    }

    return new Response(JSON.stringify({ result }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};

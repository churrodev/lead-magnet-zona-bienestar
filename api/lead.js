export default function handler(request, response) {
  response.setHeader("Allow", "POST");

  if (request.method !== "POST") {
    return response.status(405).json({
      success: false,
      error: "Método no permitido",
    });
  }

  const { name, email } = request.body ?? {};

  if (
    typeof name !== "string" ||
    name.trim() === "" ||
    typeof email !== "string" ||
    email.trim() === ""
  ) {
    return response.status(400).json({
      success: false,
      error: "Nombre y email son obligatorios",
    });
  }

  return response.status(200).json({ success: true });
}

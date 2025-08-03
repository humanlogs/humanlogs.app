export const Env = {
  server: document.location.host.includes("local")
    ? "http://localhost:2999"
    : document.location.host.includes("totext.app")
    ? "https://api.totext.app"
    : "",
  googleoauth:
    "307556896572-tfcbnodig73vtsgjmamb40v8ube9nnot.apps.googleusercontent.com",
};

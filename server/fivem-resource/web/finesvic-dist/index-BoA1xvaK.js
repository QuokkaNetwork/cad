import { importShared as e, __tla as __tla_0 } from "./__federation_fn_import-C_7gNWqI.js";
import { j as a, A as m, __tla as __tla_1 } from "./App-DcmF18PS.js";
import { r as s } from "./index-BRrI07Qo.js";
Promise.all([
  (() => {
    try {
      return __tla_0;
    } catch {
    }
  })(),
  (() => {
    try {
      return __tla_1;
    } catch {
    }
  })()
]).then(async () => {
  var r, o = s;
  r = o.createRoot, o.hydrateRoot;
  await e("react");
  const t = document.getElementById("root");
  t && r(t).render(a.jsx(m, {}));
});

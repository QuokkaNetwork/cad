import { importShared as I, __tla as __tla_0 } from "./__federation_fn_import-C_7gNWqI.js";
import { r as O } from "./index-CtmpQeow.js";
let Q, t, V;
let __tla = Promise.all([
  (() => {
    try {
      return __tla_0;
    } catch {
    }
  })()
]).then(async () => {
  var R = {
    exports: {}
  }, y = {};
  var A = O, L = Symbol.for("react.element"), W = Symbol.for("react.fragment"), E = Object.prototype.hasOwnProperty, U = A.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, B = {
    key: true,
    ref: true,
    __self: true,
    __source: true
  };
  function $(e, r, d) {
    var i, o = {}, g = null, c = null;
    d !== void 0 && (g = "" + d), r.key !== void 0 && (g = "" + r.key), r.ref !== void 0 && (c = r.ref);
    for (i in r) E.call(r, i) && !B.hasOwnProperty(i) && (o[i] = r[i]);
    if (e && e.defaultProps) for (i in r = e.defaultProps, r) o[i] === void 0 && (o[i] = r[i]);
    return {
      $$typeof: L,
      type: e,
      key: g,
      ref: c,
      props: o,
      _owner: U.current
    };
  }
  y.Fragment = W;
  y.jsx = $;
  y.jsxs = $;
  R.exports = y;
  t = R.exports;
  let H;
  V = "" + new URL("FinesVicLogo-CZ7ggJBL.jpg", import.meta.url).href;
  H = "cad_bridge";
  async function N(e, r) {
    const i = await (await fetch(`https://${H}/${e}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8"
      },
      body: JSON.stringify(r || {})
    })).text();
    try {
      return JSON.parse(i || "{}");
    } catch {
      return {
        ok: false,
        error: "invalid_json",
        message: i || "Invalid response from CAD bridge"
      };
    }
  }
  const J = await I("react"), { useEffect: M, useState: u } = J;
  function b(e) {
    const r = Number(e || 0);
    if (!Number.isFinite(r)) return "$0";
    try {
      return new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        maximumFractionDigits: 0
      }).format(r);
    } catch {
      return `$${Math.round(r).toLocaleString()}`;
    }
  }
  function w(e) {
    const r = String(e || "").trim();
    if (!r) return "";
    const d = Date.parse(r);
    if (!Number.isFinite(d)) return r;
    try {
      return new Intl.DateTimeFormat("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(new Date(d));
    } catch {
      return r;
    }
  }
  function q(e) {
    if (e?.can_pay_online) return {
      bg: "rgba(22,163,74,0.18)",
      border: "rgba(34,197,94,0.34)",
      text: "#bbf7d0"
    };
    const r = String(e?.payable_status || "").toLowerCase();
    return r === "paid" ? {
      bg: "rgba(59,130,246,0.16)",
      border: "rgba(96,165,250,0.3)",
      text: "#bfdbfe"
    } : r === "court_listed" ? {
      bg: "rgba(245,158,11,0.16)",
      border: "rgba(251,191,36,0.3)",
      text: "#fde68a"
    } : {
      bg: "rgba(148,163,184,0.14)",
      border: "rgba(148,163,184,0.22)",
      text: "#cbd5e1"
    };
  }
  function G({ status: e }) {
    if (!e?.message) return null;
    const r = e.type === "error" ? {
      border: "rgba(239,68,68,0.35)",
      bg: "rgba(127,29,29,0.18)",
      text: "#fecaca"
    } : e.type === "success" ? {
      border: "rgba(34,197,94,0.35)",
      bg: "rgba(20,83,45,0.18)",
      text: "#bbf7d0"
    } : {
      border: "rgba(245,158,11,0.3)",
      bg: "rgba(120,53,15,0.16)",
      text: "#fde68a"
    };
    return t.jsx("div", {
      style: {
        borderRadius: 12,
        border: `1px solid ${r.border}`,
        background: r.bg,
        color: r.text,
        fontSize: 12.5,
        lineHeight: 1.35,
        padding: "10px 12px",
        whiteSpace: "pre-wrap"
      },
      children: e.message
    });
  }
  function k({ notice: e, payingNoticeId: r, onPay: d }) {
    const i = q(e), o = Number(r) === Number(e?.id), g = String(e?.payable_status || "").replace(/_/g, " ").trim() || "unknown", c = w(e?.due_date), p = w(e?.court_date);
    return t.jsxs("div", {
      style: {
        borderRadius: 14,
        border: "1px solid rgba(148,163,184,0.2)",
        background: "rgba(15,23,42,0.5)",
        padding: 12,
        display: "grid",
        gap: 8
      },
      children: [
        t.jsxs("div", {
          style: {
            display: "flex",
            alignItems: "start",
            justifyContent: "space-between",
            gap: 10
          },
          children: [
            t.jsxs("div", {
              style: {
                minWidth: 0
              },
              children: [
                t.jsx("div", {
                  style: {
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#f8fbff",
                    lineHeight: 1.25
                  },
                  children: String(e?.title || "").trim() || "Infringement Notice"
                }),
                t.jsxs("div", {
                  style: {
                    fontSize: 11.5,
                    color: "#b8cae6",
                    marginTop: 2
                  },
                  children: [
                    String(e?.notice_number || `Notice #${e?.id || "?"}`),
                    String(e?.vehicle_plate || "").trim() ? ` \u2022 ${String(e.vehicle_plate).trim()}` : ""
                  ]
                })
              ]
            }),
            t.jsxs("div", {
              style: {
                textAlign: "right",
                flexShrink: 0
              },
              children: [
                t.jsx("div", {
                  style: {
                    fontSize: 15,
                    fontWeight: 800,
                    color: "#fff6d6"
                  },
                  children: b(e?.amount)
                }),
                t.jsx("div", {
                  style: {
                    marginTop: 4,
                    borderRadius: 999,
                    border: `1px solid ${i.border}`,
                    background: i.bg,
                    color: i.text,
                    padding: "3px 8px",
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "inline-block"
                  },
                  children: e?.can_pay_online ? "Pay Online" : g
                })
              ]
            })
          ]
        }),
        (c || p || e?.department_short_name) && t.jsxs("div", {
          style: {
            display: "flex",
            flexWrap: "wrap",
            gap: 6
          },
          children: [
            e?.department_short_name && t.jsx("span", {
              style: {
                fontSize: 10.5,
                color: "#dbeafe",
                border: "1px solid rgba(59,130,246,0.2)",
                background: "rgba(37,99,235,0.08)",
                borderRadius: 999,
                padding: "2px 7px"
              },
              children: e.department_short_name
            }),
            c && t.jsxs("span", {
              style: {
                fontSize: 10.5,
                color: "#e5e7eb",
                border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: 999,
                padding: "2px 7px"
              },
              children: [
                "Due ",
                c
              ]
            }),
            p && t.jsxs("span", {
              style: {
                fontSize: 10.5,
                color: "#fde68a",
                border: "1px solid rgba(245,158,11,0.22)",
                background: "rgba(245,158,11,0.05)",
                borderRadius: 999,
                padding: "2px 7px"
              },
              children: [
                "Court ",
                p
              ]
            })
          ]
        }),
        String(e?.description || "").trim() && t.jsx("div", {
          style: {
            fontSize: 11.5,
            color: "#cbd5e1",
            lineHeight: 1.35
          },
          children: String(e.description).trim()
        }),
        e?.can_pay_online ? t.jsx("button", {
          type: "button",
          onClick: () => d(e),
          disabled: o,
          style: {
            border: "1px solid rgba(234,179,8,0.35)",
            background: o ? "linear-gradient(135deg, rgba(161,98,7,0.7), rgba(146,64,14,0.65))" : "linear-gradient(135deg, #f5c84c, #eab308)",
            color: "#1f1400",
            borderRadius: 10,
            padding: "9px 10px",
            fontSize: 12.5,
            fontWeight: 800,
            cursor: o ? "default" : "pointer",
            opacity: o ? 0.9 : 1
          },
          children: o ? "Processing Payment..." : `Pay ${b(e?.amount)}`
        }) : t.jsx("div", {
          style: {
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.16)",
            background: "rgba(15,23,42,0.35)",
            color: "#9fb4d1",
            padding: "8px 10px",
            fontSize: 11.5,
            lineHeight: 1.35
          },
          children: String(e?.pay_block_reason || "").trim() || "This notice cannot be paid online."
        })
      ]
    });
  }
  Q = function() {
    const [e, r] = u(false), [d, i] = u(false), [o, g] = u(0), [c, p] = u([]), [m, h] = u({
      total_outstanding: 0,
      payable_count: 0,
      total_notices: 0
    }), [P, z] = u("bank"), [x, C] = u(""), [D, l] = u({
      type: "info",
      message: "Load your infringement notices and pay eligible fines online through Fines Victoria."
    });
    async function f({ silent: a = false } = {}) {
      if (!(e || d || o > 0)) {
        a ? i(true) : r(true), a || l({
          type: "info",
          message: "Loading your infringement notices..."
        });
        try {
          const n = await N("cadBridgeNpwdFinesVicList", {});
          if (!(n?.ok === true || n?.success === true)) {
            p([]), h({
              total_outstanding: 0,
              payable_count: 0,
              total_notices: 0
            }), l({
              type: "error",
              message: String(n?.message || "Unable to load infringement notices from Fines Victoria.")
            });
            return;
          }
          const s = Array.isArray(n?.notices) ? n.notices : [];
          p(s), h({
            total_outstanding: Number(n?.summary?.total_outstanding || 0) || 0,
            payable_count: Number(n?.summary?.payable_count || 0) || 0,
            total_notices: Number(n?.summary?.total_notices || s.length || 0) || 0
          }), z(String(n?.account || "bank")), C(String(n?.character_name || "").trim()), s.length ? (Number(n?.summary?.payable_count || 0) || 0) > 0 ? l({
            type: "success",
            message: `Loaded ${s.length} notice${s.length === 1 ? "" : "s"}. ${Number(n?.summary?.payable_count || 0)} can be paid online now.`
          }) : l({
            type: "info",
            message: `Loaded ${s.length} notice${s.length === 1 ? "" : "s"}. None are currently payable online.`
          }) : l({
            type: "success",
            message: "No infringement notices were found for your current character."
          });
        } catch (n) {
          l({
            type: "error",
            message: `Unable to contact CAD bridge: ${String(n?.message || n || "unknown error")}`
          });
        } finally {
          r(false), i(false);
        }
      }
    }
    M(() => {
      f();
    }, []);
    async function _(a) {
      const n = Number(a?.id || 0);
      if (!n || o > 0 || a?.can_pay_online !== true) return;
      const v = `Pay ${b(a?.amount)} for ${String(a?.notice_number || `Notice #${n}`)}?`;
      if (!(typeof window < "u" && typeof window.confirm == "function" && !window.confirm(v))) {
        g(n), l({
          type: "info",
          message: `Processing payment for ${String(a?.notice_number || `Notice #${n}`)}...`
        });
        try {
          const s = await N("cadBridgeNpwdFinesVicPay", {
            notice_id: n
          });
          if (!(s?.ok === true || s?.success === true)) {
            const T = s?.funds_deducted === true;
            l({
              type: "error",
              message: String(s?.message || (T ? "Funds were deducted, but CAD could not confirm the payment. Please contact staff." : "Payment failed."))
            }), await f({
              silent: true
            });
            return;
          }
          const F = s?.notice || null;
          l({
            type: "success",
            message: String(s?.message || `Payment successful for ${String(F?.notice_number || a?.notice_number || `Notice #${n}`)}.`)
          }), await f({
            silent: true
          });
        } catch (s) {
          l({
            type: "error",
            message: `Payment failed: ${String(s?.message || s || "unknown error")}`
          });
        } finally {
          g(0);
        }
      }
    }
    const S = c.filter((a) => a?.can_pay_online), j = c.filter((a) => !a?.can_pay_online);
    return t.jsxs("div", {
      style: {
        height: "100%",
        display: "flex",
        flexDirection: "column",
        color: "#f8fbff",
        background: "radial-gradient(circle at 12% 6%, rgba(245, 200, 76, 0.18), transparent 46%), linear-gradient(180deg, #1a1303 0%, #201706 55%, #130d03 100%)",
        fontFamily: "Segoe UI, system-ui, sans-serif"
      },
      children: [
        t.jsxs("div", {
          style: {
            padding: "14px 14px 8px",
            display: "flex",
            alignItems: "center",
            gap: 10
          },
          children: [
            t.jsx("div", {
              style: {
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "#fff8df",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 8px 18px rgba(0,0,0,0.25)"
              },
              children: t.jsx("img", {
                src: V,
                alt: "Fines Victoria",
                style: {
                  width: 30,
                  height: 30,
                  objectFit: "contain",
                  borderRadius: 6
                }
              })
            }),
            t.jsxs("div", {
              style: {
                minWidth: 0,
                flex: 1
              },
              children: [
                t.jsx("div", {
                  style: {
                    fontSize: 17,
                    fontWeight: 800,
                    lineHeight: 1.05,
                    color: "#fff7db"
                  },
                  children: "Fines Victoria"
                }),
                t.jsxs("div", {
                  style: {
                    color: "#d8c27e",
                    fontSize: 11.5
                  },
                  children: [
                    "Pay infringement notices online",
                    x ? ` \u2022 ${x}` : ""
                  ]
                })
              ]
            }),
            t.jsx("button", {
              type: "button",
              onClick: () => f({
                silent: false
              }),
              disabled: e || d || o > 0,
              style: {
                borderRadius: 10,
                border: "1px solid rgba(245,200,76,0.25)",
                background: "rgba(245,200,76,0.09)",
                color: "#ffe8a3",
                fontSize: 11.5,
                fontWeight: 700,
                padding: "7px 10px",
                cursor: e || d || o > 0 ? "default" : "pointer",
                opacity: e || d || o > 0 ? 0.7 : 1
              },
              children: e || d ? "Refreshing..." : "Refresh"
            })
          ]
        }),
        t.jsxs("div", {
          style: {
            padding: "0 14px 14px",
            display: "grid",
            gap: 12,
            overflow: "auto"
          },
          children: [
            t.jsx("div", {
              style: {
                borderRadius: 14,
                border: "1px solid rgba(245,200,76,0.2)",
                background: "linear-gradient(180deg, rgba(245,200,76,0.08), rgba(15,23,42,0.35))",
                padding: 12,
                display: "grid",
                gap: 8
              },
              children: t.jsxs("div", {
                style: {
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  alignItems: "center"
                },
                children: [
                  t.jsxs("div", {
                    children: [
                      t.jsx("div", {
                        style: {
                          fontSize: 11,
                          color: "#cdb56f",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em"
                        },
                        children: "Outstanding Online Payable"
                      }),
                      t.jsx("div", {
                        style: {
                          marginTop: 2,
                          fontSize: 22,
                          fontWeight: 900,
                          color: "#fff3bf"
                        },
                        children: b(m?.total_outstanding)
                      })
                    ]
                  }),
                  t.jsxs("div", {
                    style: {
                      textAlign: "right",
                      fontSize: 11.5,
                      color: "#d4d4d8"
                    },
                    children: [
                      t.jsxs("div", {
                        children: [
                          Number(m?.payable_count || 0),
                          " payable"
                        ]
                      }),
                      t.jsxs("div", {
                        children: [
                          Number(m?.total_notices || c.length || 0),
                          " total notices"
                        ]
                      }),
                      t.jsxs("div", {
                        style: {
                          color: "#aab9d3",
                          marginTop: 2
                        },
                        children: [
                          "Debit account: ",
                          String(P || "bank")
                        ]
                      })
                    ]
                  })
                ]
              })
            }),
            t.jsx(G, {
              status: D
            }),
            e && c.length === 0 ? t.jsx("div", {
              style: {
                fontSize: 12.5,
                color: "#cbd5e1",
                padding: "4px 2px"
              },
              children: "Loading notices..."
            }) : null,
            S.length > 0 && t.jsxs("div", {
              style: {
                display: "grid",
                gap: 8
              },
              children: [
                t.jsx("div", {
                  style: {
                    fontSize: 11,
                    color: "#d6c27f",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 700
                  },
                  children: "Pay Online Now"
                }),
                S.map((a) => t.jsx(k, {
                  notice: a,
                  payingNoticeId: o,
                  onPay: _
                }, `payable-${a.id}`))
              ]
            }),
            j.length > 0 && t.jsxs("div", {
              style: {
                display: "grid",
                gap: 8
              },
              children: [
                t.jsx("div", {
                  style: {
                    fontSize: 11,
                    color: "#b8c7e3",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 700
                  },
                  children: "Other Notices"
                }),
                j.map((a) => t.jsx(k, {
                  notice: a,
                  payingNoticeId: o,
                  onPay: _
                }, `other-${a.id}`))
              ]
            }),
            !e && c.length === 0 && t.jsx("div", {
              style: {
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.14)",
                background: "rgba(15,23,42,0.32)",
                padding: 12,
                fontSize: 12,
                color: "#aab9d3",
                lineHeight: 1.4
              },
              children: "No infringement notices were found for your current character. If you expected a notice, refresh after a few seconds."
            })
          ]
        })
      ]
    });
  };
});
export {
  Q as A,
  __tla,
  t as j,
  V as l
};

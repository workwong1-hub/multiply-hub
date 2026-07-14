/* Keeps index.html's confirmed UI and replaces browser-only data with Supabase. */
(function () {
  const config = window.MULTIPLY_HUB_SUPABASE || {};
  if (!config.url || !config.publishableKey || !window.supabase) return;
  const db = window.supabase.createClient(config.url, config.publishableKey);
  const dateOnly = (value) => new Date(value).toISOString().slice(0, 10);
  const emailFor = (value) => value.includes("@") ? value.trim().toLowerCase() : `${value.trim().toLowerCase()}@multiplyhub.local`;

  async function profile() {
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return null;
    const { data } = await db.from("profiles").select("username,role").eq("id", auth.user.id).single();
    return data;
  }

  async function loadSharedData() {
    const [campaign, products, donations, orderRows] = await Promise.all([
      db.from("campaigns").select("goal_amount").eq("is_active", true).limit(1).maybeSingle(),
      db.from("products").select("id,name,category,price,stock_quantity,image_url").eq("is_active", true).order("category").order("name"),
      db.from("donations").select("donor_name,amount,payment_method,destination,created_at").order("created_at"),
      db.from("pos_orders").select("id,receipt_no,customer_name,customer_email,payment_method,reference_no,subtotal,created_at,pos_order_items(product_id,product_name,unit_price,quantity)").order("created_at"),
    ]);
    if (campaign.data) campaignGoal = Number(campaign.data.goal_amount);
    const productMap = new Map();
    items = (products.data || []).map((product) => {
      const item = [product.name, product.category, Number(product.price), Number(product.stock_quantity), product.image_url || ""];
      item.dbId = product.id; productMap.set(product.id, item); return item;
    });
    dons = (donations.data || []).map((donation) => [dateOnly(donation.created_at), donation.donor_name || "匿名支持者", Number(donation.amount), donation.payment_method, donation.destination]);
    orders = (orderRows.data || []).map((order) => ({
      id: order.receipt_no, date: dateOnly(order.created_at), total: Number(order.subtotal), method: order.payment_method,
      reference: order.reference_no || "", customerName: order.customer_name || "", customerEmail: order.customer_email || "",
      lines: (order.pos_order_items || []).map((line) => ({ i: productMap.get(line.product_id) || Object.assign([line.product_name, "", Number(line.unit_price), 0, ""], { dbId: line.product_id }), q: Number(line.quantity), customPrice: Number(line.unit_price) })),
    }));
    render();
  }

  window.login = async function (event) {
    event.preventDefault();
    const data = new FormData(event.target); const username = String(data.get("username") || "");
    const { error } = await db.auth.signInWithPassword({ email: emailFor(username), password: String(data.get("password") || "") });
    if (error) { document.getElementById("loginError").textContent = "用户名或密码不正确。"; return; }
    const user = await profile();
    if (!user) { document.getElementById("loginError").textContent = "账户没有权限设定。"; await db.auth.signOut(); return; }
    document.getElementById("loginScreen").classList.add("hidden"); applyRole(user.role); await loadSharedData(); showConnected();
  };
  window.logout = async function () { await db.auth.signOut(); document.getElementById("loginScreen").classList.remove("hidden"); };
  window.completeCheckout = async function (reference, customer = { name: "", email: "" }) {
    if (!cart.length) return;
    const p_items = cart.map((line) => ({ product_id: line.i.dbId, quantity: line.q, unit_price: linePrice(line) }));
    if (p_items.some((line) => !line.product_id)) { alert("产品尚未同步完成，请重新载入。 "); return; }
    const { error } = await db.rpc("create_pos_order", { p_payment_method: document.getElementById("method").value, p_reference_no: reference || "", p_customer_name: customer.name || "", p_customer_email: customer.email || "", p_items });
    if (error) { alert(error.message); return; }
    cart = []; await loadSharedData();
  };
  window.saveDonation = async function (event) {
    event.preventDefault(); const data = new FormData(event.target);
    const { error } = await db.rpc("record_donation", { p_donor_name: String(data.get("name") || ""), p_amount: Number(data.get("amount")), p_payment_method: String(data.get("method") || "现金"), p_destination: String(data.get("destination") || "general") });
    if (error) { alert(error.message); return; }
    closeDonation(); event.target.reset(); await loadSharedData();
  };
  function showConnected() { if (document.getElementById("supabaseConnected")) return; const note = document.createElement("div"); note.id = "supabaseConnected"; note.textContent = "Supabase 已连接"; note.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:9999;background:#e4f8ef;color:#167a55;border:1px solid #bce8d7;border-radius:999px;padding:8px 12px;font:12px Arial;box-shadow:0 5px 16px #1b6d4922"; document.body.appendChild(note); }
  db.auth.getSession().then(async ({ data }) => { if (!data.session) { sessionStorage.removeItem("fmsRole"); sessionStorage.removeItem("fmsUser"); document.getElementById("loginScreen").classList.remove("hidden"); return; } const user = await profile(); if (user) { document.getElementById("loginScreen").classList.add("hidden"); applyRole(user.role); await loadSharedData(); showConnected(); } });
  db.channel("multiply-hub-html").on("postgres_changes", { event: "*", schema: "public", table: "products" }, loadSharedData).on("postgres_changes", { event: "*", schema: "public", table: "donations" }, loadSharedData).on("postgres_changes", { event: "*", schema: "public", table: "pos_orders" }, loadSharedData).on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, loadSharedData).subscribe();
})();

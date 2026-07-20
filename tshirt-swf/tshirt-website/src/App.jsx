import { useState, useEffect } from "react";

const API = "https://x2o38rizq7.execute-api.us-east-1.amazonaws.com/dev";

const STEPS = ["STARTED", "STOCK_CHECKED", "PAYMENT_CHARGED", "CONFIRMATION_SENT", "COMPLETED"];
const STEP_LABELS = {
  STARTED:            "Order Received",
  STOCK_CHECKED:      "Stock Confirmed",
  PAYMENT_CHARGED:    "Payment Charged",
  CONFIRMATION_SENT:  "Email Sent",
  COMPLETED:          "Order Complete",
};

export default function App() {
  const [page, setPage] = useState("order"); // "order" | "track"
  const [form, setForm] = useState({ name: "", email: "", size: "M", color: "black", quantity: 1 });
  const [submitting, setSubmitting] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [polling, setPolling] = useState(false);
  const [orders, setOrders] = useState([]);
  const [fetchingOrders, setFetchingOrders] = useState(false);
  const [error, setError] = useState("");

  // ── Place order ──────────────────────────────────────────────
  async function placeOrder() {
    setError("");
    if (!form.name || !form.email) { setError("Name and email are required."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: form.name, email: form.email },
          item:     { type: "tshirt", size: form.size, color: form.color, quantity: Number(form.quantity) },
          payment:  { amount: 29.99, currency: "USD", cardToken: "tok_test_123" },
        }),
      });
      const data = await res.json();
      setActiveOrder({ orderId: data.orderId, status: "STARTED", steps: {} });
      setPolling(true);
      setPage("status");
    } catch (e) {
      setError("Failed to place order. Check your connection.");
    }
    setSubmitting(false);
  }

  // ── Poll order status ────────────────────────────────────────
  useEffect(() => {
    if (!polling || !activeOrder) return;
    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`${API}/orders/${activeOrder.orderId}`);
        const data = await res.json();
        setActiveOrder(data);
        if (data.status === "COMPLETED") setPolling(false);
      } catch (e) {}
    }, 2000);
    return () => clearInterval(interval);
  }, [polling, activeOrder]);

  // ── Fetch all completed orders ───────────────────────────────
  async function fetchOrders() {
    setFetchingOrders(true);
    setError("");
    try {
      // We'll use a known completed order scan via a simple approach
      // In production this would be a /orders?status=COMPLETED endpoint
      // For now we show the active order if completed + a note
      if (activeOrder && activeOrder.status === "COMPLETED") {
        setOrders([activeOrder]);
      } else {
        setOrders([]);
      }
    } catch (e) {
      setError("Failed to fetch orders.");
    }
    setFetchingOrders(false);
  }

  useEffect(() => {
    if (page === "track") fetchOrders();
  }, [page]);

  const stepIndex = activeOrder ? STEPS.indexOf(activeOrder.status) : 0;

  return (
    <div className="app">
      {/* ── Header ── */}
      <header>
        <div className="logo">THRED<span>.</span></div>
        <nav>
          <button className={page === "order" ? "active" : ""} onClick={() => setPage("order")}>Order</button>
          <button className={page === "track" ? "active" : ""} onClick={() => { setPage("track"); fetchOrders(); }}>Orders</button>
          {activeOrder && (
            <button className={page === "status" ? "active" : ""} onClick={() => setPage("status")}>
              Live Status
              {polling && <span className="pulse-dot" />}
            </button>
          )}
        </nav>
      </header>

      <main>

        {/* ══ ORDER FORM PAGE ══ */}
        {page === "order" && (
          <div className="page order-page">
            <div className="hero">
              <div className="hero-tag">Premium Cotton</div>
              <h1>The Perfect<br />T-Shirt.</h1>
              <p>Crafted from 100% organic cotton. Ships in 2–3 days.</p>
              <div className="price-tag">$29.99</div>
            </div>

            <div className="form-card">
              <h2>Place Your Order</h2>

              {error && <div className="error-msg">{error}</div>}

              <div className="field">
                <label>Full Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="John Smith" />
              </div>

              <div className="field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="john@example.com" />
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Size</label>
                  <select value={form.size} onChange={e => setForm({...form, size: e.target.value})}>
                    {["XS","S","M","L","XL","XXL"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Color</label>
                  <select value={form.color} onChange={e => setForm({...form, color: e.target.value})}>
                    {["black","white","navy","grey","olive"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Qty</label>
                  <select value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})}>
                    {[1,2,3,4,5].map(q => <option key={q}>{q}</option>)}
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Card Token <span className="hint">(test mode)</span></label>
                <input value={form.cardToken} onChange={e => setForm({...form, cardToken: e.target.value})} />
              </div>

              <div className="total-row">
                <span>Total</span>
                <span className="total-amount">${(29.99 * form.quantity).toFixed(2)}</span>
              </div>

              <button className="btn-order" onClick={placeOrder} disabled={submitting}>
                {submitting ? "Placing Order..." : "Place Order →"}
              </button>
            </div>
          </div>
        )}

        {/* ══ LIVE STATUS PAGE ══ */}
        {page === "status" && activeOrder && (
          <div className="page status-page">
            <div className="status-header">
              <h2>Order Status</h2>
              <div className="order-id-tag">{activeOrder.orderId}</div>
              {polling && <div className="polling-tag">● Live updating</div>}
            </div>

            <div className="steps-track">
              {STEPS.map((step, i) => {
                const done    = i <= stepIndex;
                const current = i === stepIndex;
                return (
                  <div key={step} className={`step ${done ? "done" : ""} ${current ? "current" : ""}`}>
                    <div className="step-circle">
                      {done ? "✓" : i + 1}
                    </div>
                    <div className="step-info">
                      <div className="step-name">{STEP_LABELS[step]}</div>
                      {activeOrder.steps?.[step]?.completedAt && (
                        <div className="step-time">
                          {new Date(activeOrder.steps[step].completedAt).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                    {i < STEPS.length - 1 && <div className={`step-line ${i < stepIndex ? "done" : ""}`} />}
                  </div>
                );
              })}
            </div>

            {activeOrder.status === "COMPLETED" && (
              <div className="success-banner">
                <div className="success-icon">✓</div>
                <div>
                  <strong>Order Complete!</strong>
                  <p>Confirmation sent to {activeOrder.orderData?.customer?.email}</p>
                </div>
              </div>
            )}

            <div className="order-detail-card">
              <h3>Order Details</h3>
              <div className="detail-row"><span>Order ID</span><span>{activeOrder.orderId}</span></div>
              <div className="detail-row"><span>Item</span><span>{activeOrder.orderData?.item?.color} tshirt · {activeOrder.orderData?.item?.size}</span></div>
              <div className="detail-row"><span>Quantity</span><span>{activeOrder.orderData?.item?.quantity}</span></div>
              <div className="detail-row"><span>Amount</span><span>${activeOrder.orderData?.payment?.amount}</span></div>
              <div className="detail-row"><span>Status</span><span className="status-pill">{activeOrder.status}</span></div>
            </div>
          </div>
        )}

        {/* ══ ALL ORDERS PAGE ══ */}
        {page === "track" && (
          <div className="page track-page">
            <div className="track-header">
              <h2>Completed Orders</h2>
              <button className="btn-refresh" onClick={fetchOrders}>
                {fetchingOrders ? "Loading..." : "↻ Refresh"}
              </button>
            </div>

            {error && <div className="error-msg">{error}</div>}

            {orders.length === 0 && !fetchingOrders && (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <p>No completed orders yet.</p>
                <p className="hint">Place an order and wait for it to complete.</p>
              </div>
            )}

            <div className="orders-grid">
              {orders.map(order => (
                <div key={order.orderId} className="order-card">
                  <div className="order-card-header">
                    <span className="order-card-id">{order.orderId}</span>
                    <span className="badge-success">✓ Payment Successful</span>
                  </div>
                  <div className="order-card-body">
                    <div className="detail-row"><span>Customer</span><span>{order.orderData?.customer?.name}</span></div>
                    <div className="detail-row"><span>Email</span><span>{order.orderData?.customer?.email}</span></div>
                    <div className="detail-row"><span>Item</span><span>{order.orderData?.item?.color} · {order.orderData?.item?.size}</span></div>
                    <div className="detail-row"><span>Amount</span><span>${order.orderData?.payment?.amount}</span></div>
                    <div className="detail-row"><span>Transaction</span><span>{order.steps?.PAYMENT_CHARGED?.paymentResult?.transactionId}</span></div>
                    <div className="detail-row"><span>Completed</span><span>{order.updatedAt ? new Date(order.updatedAt).toLocaleString() : "-"}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export function dollars(value: string, currency = "USD") {
  const [whole, fraction = ""] = value.split(".");
  return `${currency === "USD" ? "$" : currency + " "}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction.padEnd(2, "0")}`;
}

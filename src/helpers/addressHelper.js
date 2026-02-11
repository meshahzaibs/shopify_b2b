export function buildAddress({
  fname,
  lname,
  company,
  street,
  addr2,
  addr3,
  city,
  state,
  zip,
  country = "US",
}) {
  return {
    firstName: fname,
    lastName: lname,
    company: company || null,
    address1: street,
    address2: [addr2, addr3].filter(Boolean).join(" "),
    city,
    province: state,
    zip,
    country,
  };
}

// Who a new visit is booked for (pages/NewVisitPage.jsx), and how they can be told about it.
import { mayText, normalizePhone } from "./smsConsent";

// A number on the form that the server cannot text (too short, for example).
const unreachable = (who) => Boolean(who?.phone?.trim()) && normalizePhone(who.phone) === null;

// chosen: an existing client picked on the page; serviceRequest: the request it was started
// from; customer: the new customer typed in. A request linked to a client books that client,
// so the visit's texts and emails go to the client's own name, address, number and email, by
// the client's own consent. A request without one goes by the customer's tick on the form,
// except where the business has a no on record for that number (sms_state, from the server).
export function bookingContact({ chosen, serviceRequest, customer }) {
  if (chosen) return { ...chosen, existing: true, cannot_text: unreachable(chosen) };
  if (!serviceRequest) return customer && { ...customer, cannot_text: unreachable(customer) };
  const linked = serviceRequest.client;
  if (linked) {
    return {
      ...serviceRequest,
      request: true,
      name: linked.name,
      address: linked.address,
      phone: linked.phone,
      email: linked.email,
      sms_consent: linked.sms_consent,
      sms_opt_out: linked.sms_opt_out,
      cannot_text: serviceRequest.sms_state === "no_phone" || unreachable(linked),
    };
  }
  const state = serviceRequest.sms_state;
  return {
    ...serviceRequest,
    request: true,
    sms_consent: Boolean(serviceRequest.sms_consent) && (state === undefined || state === "ok"),
    sms_opt_out: state === "opted_out",
    // A number the form took that cannot get texts.
    cannot_text: state === "no_phone" || unreachable(serviceRequest),
  };
}

// What to ask the server to send: never a text the page says will not go.
export function bookingNotify(notify, who) {
  return { ...notify, sms: Boolean(notify.sms) && mayText(who) };
}

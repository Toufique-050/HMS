import test from "node:test";
import assert from "node:assert/strict";
import { nights, totals, parse, schemas } from "../../admin/rules.js";
import { RoomNight, Room, Booking, Invoice } from "../../admin/models.js";
const id = "507f1f77bcf86cd799439011";
test("Checkout date is exclusive and stays must have positive length", () => {
    assert.equal(nights("2026-10-15", "2026-10-18").length, 3);
    assert.equal(nights("2028-02-28", "2028-03-01").length, 2);
    assert.throws(() => nights("2026-10-18", "2026-10-15"));
    assert.throws(() => nights("2026-10-15", "2026-10-15"));
});
test("Invoice math includes service quantities, tax, discount and partial payments", () => {
    assert.deepEqual(totals({ chargeItems: [{ quantity: 3, unitPrice: 10000 }, { quantity: 2, unitPrice: 500 }], taxRate: 10, discount: 1000, payments: [{ amount: 10000 }] }), {
        subtotal: 31000, tax: 3100, grandTotal: 33100, paid: 10000, balance: 23100, status: "partially_paid"
    });
});
test("Discounts and payments cannot make invoice balances negative", () => {
    const invoice = { chargeItems: [{ quantity: 1, unitPrice: 100 }], taxRate: 0, discount: 0, payments: [] };
    assert.throws(() => totals({ ...invoice, discount: 101 }));
    assert.throws(() => totals({ ...invoice, payments: [{ amount: 101 }] }));
});
test("Forged frontend totals and invalid calendar dates are rejected", () => {
    const booking = { roomId: id, guestName: "Test", guestPhone: "0300", checkIn: "2026-10-15", checkOut: "2026-10-18", guests: 1 };
    assert.throws(() => parse(schemas.bookings, { ...booking, grandTotal: 1 }));
    assert.throws(() => parse(schemas.bookings, { ...booking, checkIn: "2026-02-30" }));
});
test("Room-night locking has a unique room/date index", () => {
    assert(RoomNight.schema.indexes().some(([keys, options]) => keys.roomId === 1 && keys.date === 1 && options.unique));
});
test("Room, booking and invoice documents validate without changing existing auth models", async () => {
    await new Room({ hotelId: id, roomTypeId: id, roomNumber: "101" }).validate();
    await new Booking({ reference: "BK-TEST", guestSnapshot: { name: "Test", phone: "0300" }, hotelId: id, roomId: id, roomTypeId: id, checkIn: "2026-10-15", checkOut: "2026-10-18", guests: 2, rateSnapshot: 10000 }).validate();
    await new Invoice({ number: "LS-TEST", bookingId: id, hotelId: id, chargeItems: [], payments: [], subtotal: 0, tax: 0, grandTotal: 0, paid: 0, balance: 0 }).validate();
});
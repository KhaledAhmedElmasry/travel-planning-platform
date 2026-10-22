// Authentication guard: reads the access token from the httpOnly cookie.
// Related: ACC-04, ACC-06, ACC-19, NEW-07.
// Restricted actions by a guest (book, review, post, like, comment, report) must return 401, so the
// frontend can send the guest to login and back to the action (ACC-10).

export {};

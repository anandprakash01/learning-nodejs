import AppError from "../utils/AppError.js";

export const validate = schema => (req, res, next) => {
  try {
    // 🚨 1. CAPTURE THE PARSED DATA
    // Zod returns a brand new object that is stripped, coerced, and defaulted.
    const parsedData = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    // 🚨 2. OVERWRITE THE EXPRESS PIPELINE
    // We physically mutate the request objects. Now, when the Controller reads req.body, it gets the 100% sanitized and typed Zod object.
    req.body = parsedData.body;
    // req.query = parsedData.query;
    req.params = parsedData.params;
    next();
  } catch (err) {
    // const errMessages = err.errors.map(e => e.message).join(", ");

    // 🚨 THE FIX: Look for .issues first (v4), fallback to .errors (v3), or default to empty array
    const validationIssues = err.issues || err.errors || [];
    // Now we safely map over the guaranteed array
    const errMessages = validationIssues.map(issue => issue.message).join(", ");
    // In Zod v3, when validation failed, the error object contained a property called .errors.
    // In Zod v4, the architects of the library completely removed .errors to clean up their codebase. The array of failed rules is now strictly located inside a property called .issues.
    throw new AppError(`Validation failed: ${errMessages}`, 400);
  }

  // const result = schema.safeParse({
  //   body: req.body,
  //   query: req.query,
  //   params: req.params,
  // });
  // // predictable object: { success: true, data: ... } or { success: false, error: ... }
  // if (!result.success) {
  //   // const errMessages = result.error.errors.map(e => e.message).join(", ");
  //   // In Zod v3, when validation failed, the error object contained a property called .errors.
  //   // In Zod v4, the architects of the library completely removed .errors to clean up their codebase. The array of failed rules is now strictly located inside a property called .issues.
  //   // 🚨 THE FIX: Look for .issues first (v4), fallback to .errors (v3), or default to empty array
  //   const validationIssues = result.error.issues || result.error.errors || [];
  //   // Now we safely map over the guaranteed array
  //   const errorMessages = validationIssues.map(issue => issue.message).join(", ");
  //   throw new AppError(`Validation failed: ${errorMessages}`, 400);
  // }
  // req.body = result.data.body;
  // // req.query = result.data.query;//Error
  // req.params = result.data.params;
  // next();
};
// In Express 4, req.query was just a normal JavaScript object. You could overwrite it using the = operator whenever you wanted.

// But in Express 5. To optimize server RAM, the Express team changed req.query. It is no longer an object; it is a Getter. It is a lazy function that only parses the URL string the exact millisecond you ask for it. Because it is defined purely as a "getter function," the V8 engine violently rejects any attempt to overwrite it using an = sign.

// The Enterprise Fix:
// To bypass this, we cannot use the standard assignment operator. We must use a low-level V8 memory command (Object.defineProperty) to physically destroy the Express 5 Getter and replace it with our sanitized Zod object.
// if (parsedData.query) {
//   Object.defineProperty(req, "query", {
//     value: parsedData.query,
//     writable: true,
//     enumerable: true,
//     configurable: true,
//   });
// }

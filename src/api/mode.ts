// Mock or real, for the whole app, chosen when it's built: VITE_API=real (npm
// run dev:real) sends the functions already on the API to it. Mock is the
// default until #43.
export const realApi = import.meta.env.VITE_API === 'real'

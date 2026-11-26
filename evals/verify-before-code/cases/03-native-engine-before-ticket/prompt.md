A product team asks for a Learn example where someone edits a shipping address, and for a command picker that app teams can use with their own commands. A proposed brief stores every field change in a custom provider and puts the picker in the example viewport. Use ticket-create to decide what work to file. Return the decision in chat.

The following is a frozen repository fixture. There is no checkout or network in the exercise.

- The Forms guide already walks through prefill, validation and submission with named fields. Checkout uses the same public form methods.
- In the existing checkout example, calling `setValues({shipping: {city: 'Oslo'}})` prefills the city field. Erasing the required city makes `validate()` return false. Entering Bergen makes it return true and `getSubmitValues()` returns `{shipping: {city: 'Bergen'}}`.
- An advanced example uses a provider to show unsaved edits immediately in another window. The product team wants an address submission and has requested one view.
- The component inventory and public exports include a Dialog, a TextField and a keyboard-navigable List. The only command picker using them lives under `examples/workbench/`. It reads its viewport's command array and dispatches to that viewport's controller. An application consuming the package can import the three Engine classes. Its lookup of a public command picker finds no entry.

Give an acceptance check an application author could run for any remaining Engine work.

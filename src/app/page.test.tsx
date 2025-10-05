import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "./page";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("Home", () => {
  const originalDemoUserId = process.env.NEXT_PUBLIC_DEMO_USER_ID;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_USER_ID = "22222222-3333-4333-8333-222222222222";
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_DEMO_USER_ID = originalDemoUserId;
  });

  it("renders hero heading", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Challenge your property tax assessment with AI-driven guidance.",
    );
  });

  it("uploads a PDF and routes to processing", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url: RequestInfo | URL) => {
      const resolvedUrl = typeof url === "string" ? url : url.toString();

      if (resolvedUrl.includes("/api/uploads")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            bucket: "user-documents",
            path: "ingest/2025/mock.pdf",
            message: "Upload complete.",
            documentGroupId: "11111111-1111-4111-8111-111111111111",
            documentId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
            userId: "22222222-3333-4333-8333-222222222222",
          }),
        } as unknown as Response);
      }

      throw new Error(`Unexpected fetch call to ${resolvedUrl}`);
    });

    render(<Home />);

    const input = screen.getByLabelText(/Upload property tax assessment/i);
    const pdfFile = new File(["assessment"], "assessment.pdf", { type: "application/pdf" });

    await user.upload(input, pdfFile);
    await user.click(screen.getByRole("button", { name: /upload pdf/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/uploads",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledTimes(1);
    });

    const destination = pushMock.mock.calls[0]?.[0];
    expect(typeof destination).toBe("string");
    expect(destination).toContain("/processing");
    expect(destination).toContain("documentGroupId=11111111-1111-4111-8111-111111111111");
    expect(destination).toContain("path=ingest%2F2025%2Fmock.pdf");

    await screen.findByText(/Preparing your assessment insights/i);
  });
});

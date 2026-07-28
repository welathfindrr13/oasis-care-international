import { CareBridgeApprovalsClient } from "./CareBridgeApprovalsClient";

export const dynamic = "force-dynamic";

function selectedCareRoomId(value?: string) {
  const candidate = String(value || "").trim();
  return candidate && candidate.length <= 200 ? candidate : "";
}

export default async function CareBridgeApprovalsPage(props: {
  searchParams?: Promise<{ careRoomId?: string }>;
}) {
  const searchParams = await props.searchParams;
  return (
    <CareBridgeApprovalsClient
      initialCareRoomId={selectedCareRoomId(searchParams?.careRoomId)}
    />
  );
}

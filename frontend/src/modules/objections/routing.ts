import type { Route, CaseTab } from "../../types";

export function routeFromPath(path: string): Route {
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  const registryTab = params.get("view") === "requests" ? "requests" as const : undefined;
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "cases" && parts[1]) {
    const tab = ["overview", "review", "documents", "history"].includes(
      parts[2],
    )
      ? (parts[2] as CaseTab)
      : "review";
    try {
      return { page: "detail", caseId: decodeURIComponent(parts[1]), tab, ...(registryTab ? { registryTab } : {}), ...(params.get("request") ? { requestId: params.get("request")! } : {}) };
    } catch {
      return { page: "registry" };
    }
  }
  if (parts[0] === "sessions") {
    try {
      return {
        page: "sessions",
        meetingId: parts[1] ? decodeURIComponent(parts[1]) : undefined,
      };
    } catch {
      return { page: "sessions" };
    }
  }
  if (parts[0] === "recommendations" && parts[1]) {
    try {
      return { page: "recommendation", caseId: decodeURIComponent(parts[1]) };
    } catch {
      return { page: "recommendations" };
    }
  }
  if (["notifications", "recommendations", "sources", "processes"].includes(parts[0]))
    return { page: parts[0] as Route["page"] };
  return { page: "registry", ...(registryTab ? { registryTab } : {}) };
}

export function pathForRoute(route: Route): string {
  const params = new URLSearchParams();
  if (route.registryTab === "requests") params.set("view", "requests");
  if (route.requestId && route.page === "detail") params.set("request", route.requestId);
  const query = params.size ? "?" + params.toString() : "";
  if (route.page === "detail")
    return `/cases/${encodeURIComponent(route.caseId || "")}/${route.tab || "review"}${query}`;
  if (route.page === "sessions" && route.meetingId)
    return `/sessions/${encodeURIComponent(route.meetingId)}`;
  if (route.page === "recommendation")
    return `/recommendations/${encodeURIComponent(route.caseId || "")}`;
  return route.page === "registry" ? "/cases" + query : `/${route.page}`;
}

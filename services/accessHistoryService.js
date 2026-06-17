import supabase from "./supabaseService.js";

export async function recordAccessHistory({
    entityType,
    entityId = null,
    entityKey,
    action,
    details = {},
}) {
    const { error } = await supabase
        .from("access_history")
        .insert({
            entity_type: entityType,
            entity_id: entityId === null || entityId === undefined ? null : String(entityId),
            entity_key: entityKey,
            action,
            details,
        });

    if (error) {
        console.error("Access history insert failed:", error);
    }
}

export async function listAccessHistory(entityType) {
    return supabase
        .from("access_history")
        .select("id, entity_type, entity_id, entity_key, action, details, created_at")
        .eq("entity_type", entityType)
        .order("created_at", { ascending: false });
}

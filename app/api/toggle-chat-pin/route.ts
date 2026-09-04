import { getPostHogClient } from "@/lib/posthog-server"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { chatId, pinned } = await request.json()

    if (!chatId || typeof pinned !== "boolean") {
      return NextResponse.json(
        { error: "Missing chatId or pinned" },
        { status: 400 }
      )
    }

    if (!supabase) {
      return NextResponse.json({ success: true }, { status: 200 })
    }

    const toggle = pinned
      ? { pinned: true, pinned_at: new Date().toISOString() }
      : { pinned: false, pinned_at: null }

    const { error } = await supabase
      .from("chats")
      .update(toggle)
      .eq("id", chatId)

    if (error) {
      return NextResponse.json(
        { error: "Failed to update pinned" },
        { status: 500 }
      )
    }

    const { data: authData } = await supabase.auth.getUser()
    const userId = authData?.user?.id
    if (userId) {
      const posthog = getPostHogClient()
      if (posthog) {
        posthog.capture({
          distinctId: userId,
          event: "chat_pinned",
          properties: { chat_id: chatId, pinned },
        })
        await posthog.flush()
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("toggle-chat-pin unhandled error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

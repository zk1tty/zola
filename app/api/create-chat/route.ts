import { getPostHogClient } from "@/lib/posthog-server"
import { createChatInDb } from "./api"

export async function POST(request: Request) {
  try {
    const { userId, title, model, isAuthenticated, projectId } =
      await request.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
      })
    }

    const chat = await createChatInDb({
      userId,
      title,
      model,
      isAuthenticated,
      projectId,
    })

    if (!chat) {
      return new Response(
        JSON.stringify({ error: "Supabase not available in this deployment." }),
        { status: 200 }
      )
    }

    const posthog = getPostHogClient()
    if (posthog) {
      posthog.capture({
        distinctId: userId,
        event: "chat_created",
        properties: {
          model,
          is_authenticated: isAuthenticated,
          has_project: Boolean(projectId),
        },
      })
      await posthog.flush()
    }

    return new Response(JSON.stringify({ chat }), { status: 200 })
  } catch (err: unknown) {
    console.error("Error in create-chat endpoint:", err)

    if (err instanceof Error && err.message === "DAILY_LIMIT_REACHED") {
      return new Response(
        JSON.stringify({ error: err.message, code: "DAILY_LIMIT_REACHED" }),
        { status: 403 }
      )
    }

    return new Response(
      JSON.stringify({
        error: (err as Error).message || "Internal server error",
      }),
      { status: 500 }
    )
  }
}

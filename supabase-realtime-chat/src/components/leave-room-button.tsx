"use client"

import { ComponentProps } from "react"
import { ActionButton } from "./ui/action-button"
import { createClient } from "@/services/supabase/client"
import { useRouter } from "next/navigation"

export function LeaveRoomButton({
  children,
  roomId,
  redirectTo,
  ...props
}: Omit<ComponentProps<typeof ActionButton>, "action"> & {
  roomId: string
  redirectTo?: string
}) {
  const router = useRouter()

  async function leaveRoom() {
    const supabase = createClient()
    const { error } = await supabase
      .from("chat_room_member")
      .delete()
      .eq("chat_room_id", roomId)

    if (error) {
      return { error: true, message: "Failed to leave room" }
    }

    if (redirectTo) {
      router.push(redirectTo)
    } else {
      router.refresh()
    }

    return { error: false }
  }

  return (
    <ActionButton {...props} action={leaveRoom}>
      {children}
    </ActionButton>
  )
}

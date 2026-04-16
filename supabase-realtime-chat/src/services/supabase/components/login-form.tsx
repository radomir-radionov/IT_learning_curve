"use client"

import { cn } from "@/lib/utils"
import { createClient } from "@/services/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const validateEmailPassword = () => {
    if (!email.trim() || !password) {
      setError("Email and password are required.")
      return false
    }
    return true
  }

  const handleEmailPasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateEmailPassword()) return

    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setInfo(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) throw error
      router.push("/")
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setIsLoading(false)
    }
  }

  const handleEmailPasswordSignUp = async () => {
    if (!validateEmailPassword()) return

    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setInfo(null)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/oauth?next=/`,
        },
      })

      if (error) throw error

      if (!data.session) {
        setInfo("Account created. Check your email to confirm your account.")
        setIsLoading(false)
        return
      }

      router.push("/")
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setIsLoading(false)
    }
  }

  const handleSocialLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setInfo(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/oauth?next=/`,
        },
      })

      if (error) throw error
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Welcome!</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailPasswordSignIn}>
            <FieldGroup>
              {error && <FieldError>{error}</FieldError>}
              {info && <p className="text-sm text-muted-foreground">{info}</p>}

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </Field>

              <Field orientation="horizontal" className="w-full">
                <Button type="submit" className="grow" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleEmailPasswordSignUp}
                  disabled={isLoading}
                >
                  Create account
                </Button>
              </Field>

              <FieldSeparator>or</FieldSeparator>

              <Button
                type="button"
                className="w-full"
                variant="outline"
                disabled={isLoading}
                onClick={(e) => {
                  void handleSocialLogin(e as unknown as React.FormEvent)
                }}
              >
                {isLoading ? "Logging in..." : "Continue with GitHub"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

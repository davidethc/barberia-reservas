import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="pb-2 text-center">
          <CardTitle className="text-2xl">Exclusive Barber Shop</CardTitle>
          <CardDescription>Ingresa con tu cuenta de staff</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}

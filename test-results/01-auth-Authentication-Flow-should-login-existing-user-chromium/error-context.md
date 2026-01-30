# Page snapshot

```yaml
- generic [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - button "Open Next.js Dev Tools" [ref=e8] [cursor=pointer]:
    - img [ref=e9]
  - alert [ref=e12]
  - generic: ⌘K
  - main [ref=e13]:
    - generic [ref=e15]:
      - heading "Login to Vizora" [level=1] [ref=e16]
      - generic [ref=e17]:
        - generic [ref=e18]:
          - generic [ref=e19]: Email
          - textbox "Email address" [ref=e20]:
            - /placeholder: you@example.com
          - alert [ref=e21]: Please enter a valid email address
        - generic [ref=e22]:
          - generic [ref=e23]: Password
          - textbox "Password" [ref=e24]:
            - /placeholder: ••••••••
            - text: Test123!@#
        - button "Log in to your account" [active] [ref=e25] [cursor=pointer]: Login
      - paragraph [ref=e26]:
        - text: Don't have an account?
        - link "Sign up" [ref=e27] [cursor=pointer]:
          - /url: /register
```
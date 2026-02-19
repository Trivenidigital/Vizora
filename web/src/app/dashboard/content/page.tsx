import ContentClient from './page-client';

export default async function ContentPage() {
 // Content page loads data client-side due to complex folder/filter state
 // The server component provides the shell for streaming
 return <ContentClient />;
}

import { Redirect } from 'expo-router';

export default function LogHealthRedirect() {
  return <Redirect href="/health/add-record" />;
}

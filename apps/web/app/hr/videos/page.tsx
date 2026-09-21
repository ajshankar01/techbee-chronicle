import { redirect } from 'next/navigation';

/**
 * /hr/videos — permanently redirected to /hr/recordings
 * The canonical recording archive route is /hr/recordings.
 */
export default function VideosRedirectPage() {
  redirect('/hr/recordings');
}

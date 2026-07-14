import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import Card from '@commercetools-uikit/card';

/**
 * Temporary stand-in for screens landing in later tickets (MTC-O5..O9).
 * Keeps routes resolvable so the shell boots and the menu works end-to-end.
 */
export default function Placeholder({
  title,
  ticket,
  children,
}: {
  title: string;
  ticket: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Spacings.Stack scale="m">
        <Text.Headline as="h1">{title}</Text.Headline>
        <Card>
          <Spacings.Stack scale="s">
            <Text.Body tone="secondary">
              Coming next — {ticket}. This screen is scaffolded and routed; the
              interactive build lands in the corresponding ticket.
            </Text.Body>
            {children}
          </Spacings.Stack>
        </Card>
      </Spacings.Stack>
    </div>
  );
}

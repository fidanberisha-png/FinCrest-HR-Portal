export default function StatusBadge(props) {
  const status = props.status || 'PENDING';
  return <span className={'badge ' + status}>{status}</span>;
}

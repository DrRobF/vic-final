export default function TestPage() {
  const handleClick = () => {
    alert('It works!');
  };

  return (
    <main>
      <h1>Codex is working</h1>
      <button type="button" onClick={handleClick}>
        Click Me
      </button>
    </main>
  );
}

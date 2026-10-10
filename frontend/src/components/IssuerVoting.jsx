import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import API from "../api/client";
import { AMOY_CHAIN_HEX, AMOY_NETWORK, CONTRACT_ADDRESS, VOTING_ABI } from "../config/contractV2";

const addr = (v) => String(v || "").toLowerCase();

export default function IssuerVoting({ adminKey }) {
  const [wallet, setWallet] = useState(null), [validator, setValidator] = useState(false);
  const [rule, setRule] = useState(null), [proposals, setProposals] = useState([]), [issuers, setIssuers] = useState([]);
  const [form, setForm] = useState({ name: "", wallet_address: "", contact_email: "" });
  const [votedIds, setVotedIds] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const headers = { "x-admin-key": adminKey };

  const refresh = useCallback(async () => {
    const [{ data: p }, { data: v }, { data: i }] = await Promise.all([
      API.get("/api/issuers/proposals"), API.get("/api/issuers/validators"), API.get("/api/issuers"),
    ]);
    setProposals(p.proposals || []); setRule(v); setIssuers(i.issuers || []);
  }, []);
  useEffect(() => { refresh().catch((e) => toast.error(e.response?.data?.message || e.message)); }, [refresh]);
  useEffect(() => {
    if (!wallet || !validator) { setVotedIds(new Set()); return; }
    Promise.all(proposals.map(async p => [String(p.proposal_id), await wallet.contract.hasVoted(p.proposal_id, wallet.address)]))
      .then(rows => setVotedIds(new Set(rows.filter(([, voted]) => voted).map(([id]) => id))))
      .catch(e => toast.error(e.shortMessage || e.message));
  }, [wallet, validator, proposals]);

  async function connect() {
    if (!window.ethereum) return toast.error("Install MetaMask to vote");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      try { await provider.send("wallet_switchEthereumChain", [{ chainId: AMOY_CHAIN_HEX }]); }
      catch (e) { if (e.code !== 4902) throw e; await provider.send("wallet_addEthereumChain", [AMOY_NETWORK]); }
      const signer = await provider.getSigner(), address = await signer.getAddress();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, VOTING_ABI, provider);
      const valid = await contract.isValidator(address);
      setWallet({ provider, signer, address, contract: contract.connect(signer) }); setValidator(valid);
      toast.success(valid ? "Validator wallet connected" : "Connected in read-only mode");
    } catch (e) { toast.error(e.shortMessage || e.message); }
  }

  async function sync(tx, extra = {}) {
    await API.post("/api/issuers/sync", { txHash: tx.hash, ...extra }, { headers }); await refresh();
  }
  async function propose(e) {
    e.preventDefault(); setBusy(true);
    try { const tx = await wallet.contract.proposeIssuer(form.wallet_address); await tx.wait(1); await sync(tx, { name: form.name, contact_email: form.contact_email }); setForm({ name: "", wallet_address: "", contact_email: "" }); toast.success("Issuer proposal recorded"); }
    catch (e) { toast.error(e.shortMessage || e.response?.data?.message || e.message); } finally { setBusy(false); }
  }
  async function remove(candidate) {
    setBusy(true); try { const tx = await wallet.contract.proposeRemoval(candidate); await tx.wait(1); await sync(tx); toast.success("Removal proposal recorded"); }
    catch (e) { toast.error(e.shortMessage || e.response?.data?.message || e.message); } finally { setBusy(false); }
  }
  async function vote(id, approve) {
    setBusy(true); try { const tx = await wallet.contract.voteOnProposal(id, approve); await tx.wait(1); await sync(tx); toast.success("Vote recorded"); }
    catch (e) { toast.error(e.shortMessage || e.response?.data?.message || e.message); } finally { setBusy(false); }
  }

  return <div className="card admin-card">
    <div className="verification-request-header"><div><h3 style={{ color: "#f1f5f9" }}>Issuer Voting</h3>
      <p>{rule ? `${rule.unanimous ? "Unanimous" : "Majority"}: ${rule.required} of ${rule.total} validators` : "Loading validator rule…"}</p></div>
      <button className="btn btn-outline btn-sm" onClick={connect}>{wallet ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}${validator ? " (validator)" : " (read only)"}` : "Connect wallet"}</button>
    </div>
    {validator && <form onSubmit={propose} className="grid-2" style={{ margin: "1.5rem 0" }}>
      <input className="input" placeholder="University name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/>
      <input className="input" placeholder="University wallet address" required value={form.wallet_address} onChange={e => setForm({ ...form, wallet_address: e.target.value })}/>
      <input className="input" type="email" placeholder="Contact email (optional)" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })}/>
      <button className="btn btn-primary" disabled={busy || !wallet}>{busy ? "Submitting…" : "Propose issuer"}</button>
    </form>}
    <h4 style={{ margin: "1rem 0" }}>Proposals</h4>
    {proposals.length === 0 ? <p>No proposals yet.</p> : <div className="table-wrapper"><table><thead><tr><th>Candidate</th><th>Type</th><th>Tally</th><th>Status</th><th>Votes</th></tr></thead><tbody>
      {proposals.map(p => { const voted = votedIds.has(String(p.proposal_id)); const open = p.status === "open"; return <tr key={p.proposal_id}>
        <td className="mono">{p.candidate_wallet}</td><td>{p.is_removal ? "Removal" : "Issuer"}</td><td>{p.approvals} of {p.required} approved · {p.rejections} rejected</td><td>{p.status}</td>
        <td>{validator && open && <><button className="btn btn-sm btn-primary" disabled={busy || voted} onClick={() => vote(p.proposal_id, true)}>{voted ? "Voted" : "Approve"}</button> <button className="btn btn-sm btn-danger" disabled={busy || voted} onClick={() => vote(p.proposal_id, false)}>Reject</button></>}</td>
      </tr>; })}
    </tbody></table></div>}
    {validator && issuers.length > 0 && <><h4 style={{ margin: "1.5rem 0 1rem" }}>Approved issuers</h4>{issuers.map(i => <div key={i.wallet_address} style={{ display: "flex", justifyContent: "space-between", padding: ".6rem 0" }}><span>{i.name} · <span className="mono">{i.wallet_address}</span></span><button className="btn btn-danger btn-sm" disabled={busy} onClick={() => remove(i.wallet_address)}>Propose removal</button></div>)}</>}
  </div>;
}

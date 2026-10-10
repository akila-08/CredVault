import supabase from "../services/supabaseService.js";
import { getValidators, getProposal, getProposalCount, isAuthorizedUniversity, parseVotingReceipt } from "../services/blockchainService.js";

export async function listValidators(req, res) {
  try {
    const chain = await getValidators();
    const { data = [], error } = await supabase.from("validators1").select("wallet_address,label");
    if (error) throw error;
    const labels = new Map(data.map(v => [v.wallet_address.toLowerCase(), v.label]));
    res.json({ success: true, ...chain, validators: chain.addresses.map(address => ({ address: address.toLowerCase(), label: labels.get(address.toLowerCase()) || null })) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
}

export async function listProposals(req, res) {
  try {
    const { data, error } = await supabase.from("issuer_proposals1").select("*,issuer_votes1(*)").order("proposal_id", { ascending: false });
    if (error) throw error;
    const storedProposals = new Map((data || []).map((proposal) => [String(proposal.proposal_id), proposal]));
    const proposalCount = await getProposalCount();
    const proposals = await Promise.all(Array.from({ length: proposalCount }, async (_, index) => {
      const proposalId = index + 1;
      const chainProposal = await getProposal(proposalId);
      const storedProposal = storedProposals.get(String(proposalId));
      const matchingStoredProposal = storedProposal
        && chainProposal.candidate.toLowerCase() === storedProposal.candidate_wallet.toLowerCase()
        ? storedProposal
        : {};
      return {
        ...matchingStoredProposal,
        proposal_id: proposalId,
        candidate_wallet: chainProposal.candidate.toLowerCase(),
        is_removal: chainProposal.isRemoval,
        status: chainProposal.status,
        approvals: chainProposal.approvals,
        rejections: chainProposal.rejections,
        required: chainProposal.required,
        total_validators: chainProposal.totalValidators,
      };
    }));
    res.json({ success: true, proposals });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
}

export async function listIssuers(req, res) {
  try {
    const { data, error } = await supabase.from("issuer_registry1").select("id,name,wallet_address,contact_email,status,proposal_id,created_at").eq("status", "approved").order("created_at", { ascending: false });
    if (error) throw error;
    const issuers = await Promise.all((data || []).map(async (issuer) => (
      await isAuthorizedUniversity(issuer.wallet_address) ? issuer : null
    )));
    const authorizedIssuers = issuers.filter(Boolean);
    res.json({ success: true, universities: authorizedIssuers, issuers: authorizedIssuers });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
}

export async function syncVotingTransaction(req, res) {
  try {
    const { txHash, name, contact_email } = req.body;
    if (!/^0x[\da-f]{64}$/i.test(txHash || "")) return res.status(400).json({ success: false, message: "Valid txHash is required" });
    const { receipt, events } = await parseVotingReceipt(txHash);
    if (receipt.status !== 1) return res.status(400).json({ success: false, message: "Voting transaction failed" });
    const decoded = events.map(e => ({ name: e.name, args: e.args }));
    const created = decoded.find(e => e.name === "ProposalCreated");
    const idArg = created?.args.id ?? decoded.find(e => ["VoteCast", "ProposalResolved"].includes(e.name))?.args.id;
    if (idArg == null) return res.status(400).json({ success: false, message: "No proposal event in receipt" });
    const id = Number(idArg), p = await getProposal(id), candidate = p.candidate.toLowerCase();
    const existing = await supabase.from("issuer_proposals1").select("created_tx_hash").eq("proposal_id", id).maybeSingle();
    if (existing.error) throw existing.error;
    const proposer = created?.args.proposer?.toLowerCase() || decoded.find(e => e.name === "VoteCast")?.args.validator?.toLowerCase() || "";
    const resolution = decoded.find(e => e.name === "ProposalResolved");
    const { error: proposalError } = await supabase.from("issuer_proposals1").upsert({
      proposal_id: id, candidate_wallet: candidate, is_removal: p.isRemoval, proposer_wallet: proposer,
      status: p.status, approvals: p.approvals, rejections: p.rejections, required: p.required,
      total_validators: p.totalValidators, created_tx_hash: existing.data?.created_tx_hash || (created ? txHash : null),
      resolved_tx_hash: resolution ? txHash : undefined,
      ...(p.status !== "open" ? { resolved_at: new Date().toISOString() } : {}),
    }, { onConflict: "proposal_id" });
    if (proposalError) throw proposalError;

    for (const event of decoded.filter(e => e.name === "VoteCast")) {
      const { error } = await supabase.from("issuer_votes1").upsert({ proposal_id: id,
        validator_wallet: event.args.validator.toLowerCase(), approve: event.args.approve, tx_hash: txHash,
      }, { onConflict: "proposal_id,validator_wallet" });
      if (error) throw error;
    }
    if (created && !p.isRemoval) {
      const info = { wallet_address: candidate, name: String(name || "Pending issuer").trim(), contact_email: contact_email || null, proposal_id: id,
        status: p.status === "approved" ? "approved" : p.status === "rejected" ? "rejected" : "pending", updated_at: new Date().toISOString() };
      const { error } = await supabase.from("issuer_registry1").upsert(info, { onConflict: "wallet_address" });
      if (error) throw error;
    }
    if (p.status !== "open" && (!p.isRemoval || p.status === "approved")) {
      const status = p.isRemoval ? "removed" : p.status;
      const { error } = await supabase.from("issuer_registry1")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("wallet_address", candidate);
      if (error) throw error;
    }
    res.json({ success: true, proposalId: id, proposal: p, txHash });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
}
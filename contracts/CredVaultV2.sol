// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CredVaultV2 - credential registry where issuers are approved by validator vote
/// @notice Paper-aligned variant of CredVault: a university becomes an issuer only after
///         existing validators approve it (unanimous or majority, chosen at deploy time).
contract CredVaultV2 {
    // =========================
    // VALIDATORS (fixed at deploy)
    // =========================
    address[] private validators;
    mapping(address => bool) public isValidator;
    bool public immutable unanimous;

    // =========================
    // ISSUERS (same name as V1 so the backend keeps working)
    // =========================
    mapping(address => bool) public authorizedUniversities;

    // =========================
    // PROPOSALS
    // =========================
    enum Status { None, Open, Approved, Rejected }

    struct Proposal {
        address candidate;
        bool isRemoval;
        uint256 approvals;
        uint256 rejections;
        uint256 required;
        uint256 totalValidators;
        Status status;
        uint256 createdAt;
    }

    uint256 public proposalCount;                       // ids start at 1
    mapping(uint256 => Proposal) private proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(address => uint256) public openProposalOf;  // candidate => open proposal id (0 = none)

    // =========================
    // CREDENTIALS
    // =========================
    struct Credential {
        bool exists;
        address studentWallet;
        uint256 issuedAt;
        bool revoked;
        address issuedBy;
    }

    mapping(bytes32 => Credential) private credentials;

    // =========================
    // EVENTS
    // =========================
    event ProposalCreated(uint256 indexed id, address indexed candidate, bool isRemoval, address indexed proposer);
    event VoteCast(uint256 indexed id, address indexed validator, bool approve);
    event ProposalResolved(uint256 indexed id, address indexed candidate, bool approved, bool isRemoval);
    event UniversityAdded(address indexed university);
    event UniversityRemoved(address indexed university);

    event CredentialIssued(
        bytes32 indexed credentialHash,
        address indexed studentWallet,
        address indexed university,
        uint256 issuedAt
    );
    event CredentialRevoked(
        bytes32 indexed credentialHash,
        address indexed university,
        uint256 revokedAt
    );

    // =========================
    // MODIFIERS
    // =========================
    modifier onlyValidator() {
        require(isValidator[msg.sender], "Not a validator");
        _;
    }

    modifier onlyUniversity() {
        require(authorizedUniversities[msg.sender], "Not authorized university");
        _;
    }

    // =========================
    // CONSTRUCTOR
    // =========================
    /// @param initialValidators 1 to 20 distinct non-zero addresses
    /// @param _unanimous true = every validator must approve; false = simple majority
    constructor(address[] memory initialValidators, bool _unanimous) {
        require(
            initialValidators.length > 0 && initialValidators.length <= 20,
            "1 to 20 validators"
        );
        for (uint256 i = 0; i < initialValidators.length; i++) {
            address v = initialValidators[i];
            require(v != address(0) && !isValidator[v], "Invalid or duplicate validator");
            isValidator[v] = true;
            validators.push(v);
        }
        unanimous = _unanimous;
    }

    // =========================
    // ISSUER VOTING
    // =========================

    function requiredApprovals() public view returns (uint256) {
        uint256 n = validators.length;
        return unanimous ? n : (n / 2) + 1;
    }

    /// @notice A validator proposes a university wallet. The proposer's vote counts as approval.
    function proposeIssuer(address candidate) external onlyValidator returns (uint256) {
        require(!authorizedUniversities[candidate], "Already an issuer");
        return _propose(candidate, false);
    }

    /// @notice A validator proposes removing an existing issuer.
    function proposeRemoval(address candidate) external onlyValidator returns (uint256) {
        require(authorizedUniversities[candidate], "Not an issuer");
        return _propose(candidate, true);
    }

    function voteOnProposal(uint256 id, bool approve) external onlyValidator {
        _castVote(id, approve);
    }

    function _propose(address candidate, bool isRemoval) internal returns (uint256 id) {
        require(candidate != address(0), "Invalid address");
        require(openProposalOf[candidate] == 0, "Proposal already open");

        id = ++proposalCount;
        Proposal storage p = proposals[id];
        p.candidate = candidate;
        p.isRemoval = isRemoval;
        p.required = requiredApprovals();
        p.totalValidators = validators.length;
        p.status = Status.Open;
        p.createdAt = block.timestamp;
        openProposalOf[candidate] = id;

        emit ProposalCreated(id, candidate, isRemoval, msg.sender);
        _castVote(id, true);
    }

    function _castVote(uint256 id, bool approve) internal {
        Proposal storage p = proposals[id];
        require(p.status == Status.Open, "Proposal not open");
        require(!hasVoted[id][msg.sender], "Already voted");

        hasVoted[id][msg.sender] = true;
        if (approve) {
            p.approvals += 1;
        } else {
            p.rejections += 1;
        }
        emit VoteCast(id, msg.sender, approve);

        if (p.approvals >= p.required) {
            p.status = Status.Approved;
            delete openProposalOf[p.candidate];
            authorizedUniversities[p.candidate] = !p.isRemoval;
            if (p.isRemoval) {
                emit UniversityRemoved(p.candidate);
            } else {
                emit UniversityAdded(p.candidate);
            }
            emit ProposalResolved(id, p.candidate, true, p.isRemoval);
        } else if (p.rejections > p.totalValidators - p.required) {
            // approval threshold can no longer be reached
            p.status = Status.Rejected;
            delete openProposalOf[p.candidate];
            emit ProposalResolved(id, p.candidate, false, p.isRemoval);
        }
    }

    function getProposal(uint256 id)
        external
        view
        returns (
            address candidate,
            bool isRemoval,
            uint256 approvals,
            uint256 rejections,
            uint256 required,
            uint256 totalValidators,
            Status status,
            uint256 createdAt
        )
    {
        Proposal memory p = proposals[id];
        return (
            p.candidate,
            p.isRemoval,
            p.approvals,
            p.rejections,
            p.required,
            p.totalValidators,
            p.status,
            p.createdAt
        );
    }

    function getValidators() external view returns (address[] memory) {
        return validators;
    }

    function validatorCount() external view returns (uint256) {
        return validators.length;
    }

    // =========================
    // CREDENTIAL ISSUANCE
    // =========================

    /// @notice Issue from an approved university wallet (msg.sender is the issuer).
    function issueCredential(bytes32 credentialHash, address studentWallet)
        external
        onlyUniversity
    {
        _issue(credentialHash, studentWallet, msg.sender);
    }

    /// @notice Phase C: a relayer submits a credential signed by an approved university.
    ///         The signer is stored as issuer, so the on-chain issuer is the real university.
    function issueCredentialFor(
        bytes32 credentialHash,
        address studentWallet,
        bytes calldata signature
    ) external {
        bytes32 digest = keccak256(
            abi.encodePacked(address(this), block.chainid, credentialHash, studentWallet)
        );
        bytes32 ethSigned = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)
        );
        address signer = _recover(ethSigned, signature);
        require(authorizedUniversities[signer], "Signer not authorized university");
        _issue(credentialHash, studentWallet, signer);
    }

    function _issue(bytes32 credentialHash, address studentWallet, address issuer) internal {
        require(!credentials[credentialHash].exists, "Credential already exists");
        require(studentWallet != address(0), "Invalid student wallet");

        credentials[credentialHash] = Credential({
            exists: true,
            studentWallet: studentWallet,
            issuedAt: block.timestamp,
            revoked: false,
            issuedBy: issuer
        });

        emit CredentialIssued(credentialHash, studentWallet, issuer, block.timestamp);
    }

    function _recover(bytes32 hash, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "Bad signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Bad signature v");
        require(
            uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0,
            "Bad signature s"
        );
        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0), "Bad signature");
        return signer;
    }

    // =========================
    // REVOCATION (only the issuing university; stricter than V1)
    // =========================
    function revokeCredential(bytes32 credentialHash) external onlyUniversity {
        Credential storage c = credentials[credentialHash];
        require(c.exists, "Credential does not exist");
        require(!c.revoked, "Already revoked");
        require(c.issuedBy == msg.sender, "Only issuing university");

        c.revoked = true;
        emit CredentialRevoked(credentialHash, msg.sender, block.timestamp);
    }

    // =========================
    // VERIFICATION
    // =========================

    /// @notice Same output as V1, so existing backend code keeps working.
    function verifyCredential(bytes32 credentialHash)
        external
        view
        returns (
            bool exists,
            bool revoked,
            address studentWallet,
            uint256 issuedAt,
            address issuedBy
        )
    {
        Credential memory c = credentials[credentialHash];
        return (c.exists, c.revoked, c.studentWallet, c.issuedAt, c.issuedBy);
    }

    /// @notice Certificate and issuer checked in one call (the paper's "integrated" validation).
    function verifyWithIssuer(bytes32 credentialHash)
        external
        view
        returns (
            bool exists,
            bool revoked,
            address studentWallet,
            uint256 issuedAt,
            address issuedBy,
            bool issuerAuthorized
        )
    {
        Credential memory c = credentials[credentialHash];
        return (
            c.exists,
            c.revoked,
            c.studentWallet,
            c.issuedAt,
            c.issuedBy,
            authorizedUniversities[c.issuedBy]
        );
    }

    function credentialExists(bytes32 credentialHash) external view returns (bool) {
        return credentials[credentialHash].exists;
    }
}
